import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const API_URL = 'https://api.buffer.com';
const bankPath = new URL('../marketing/content-bank.json', import.meta.url);
const historyPath = new URL('../marketing/posting-history.json', import.meta.url);

const action = (process.env.SOCIAL_ACTION || 'dry-run').trim().toLowerCase();
const apiKey = process.env.BUFFER_API_KEY?.trim();
const explicitChannelId = process.env.BUFFER_X_CHANNEL_ID?.trim();
const channelNameHint = (process.env.BUFFER_X_CHANNEL_NAME || 'Samfa12').trim().toLowerCase();
const timeZone = (process.env.SOCIAL_TIME_ZONE || 'Australia/Sydney').trim();
const postHour = Number(process.env.SOCIAL_POST_HOUR || 8);
const postMinute = Number(process.env.SOCIAL_POST_MINUTE || 15);
const weeklyPostCount = Number(process.env.SOCIAL_WEEKLY_POST_COUNT || 7);

const allowedActions = new Set(['dry-run', 'preview-week', 'list-channels', 'draft', 'publish', 'schedule-week']);
if (!allowedActions.has(action)) {
  throw new Error(`Unsupported SOCIAL_ACTION=${action}. Use dry-run, preview-week, list-channels, draft, publish, or schedule-week.`);
}
if (!Number.isInteger(postHour) || postHour < 0 || postHour > 23 || !Number.isInteger(postMinute) || postMinute < 0 || postMinute > 59) {
  throw new Error('SOCIAL_POST_HOUR and SOCIAL_POST_MINUTE must describe a valid local clock time.');
}
if (!Number.isInteger(weeklyPostCount) || weeklyPostCount < 1 || weeklyPostCount > 10) {
  throw new Error('SOCIAL_WEEKLY_POST_COUNT must be an integer from 1 to 10.');
}

function localIsoDay(date = new Date(), zone = timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(day, amount) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + amount)).toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function offsetMinutesAt(date, zone) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
  }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value;
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(name || '');
  if (!match) throw new Error(`Could not determine UTC offset for ${zone}: ${name}`);
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0));
}

function localDateTimeToUtc(day, hour, minute, zone = timeZone) {
  const [year, month, date] = day.split('-').map(Number);
  const wallClockUtcMs = Date.UTC(year, month - 1, date, hour, minute, 0, 0);
  let guess = new Date(wallClockUtcMs);
  for (let i = 0; i < 3; i += 1) {
    const next = new Date(wallClockUtcMs - offsetMinutesAt(guess, zone) * 60000);
    if (Math.abs(next.getTime() - guess.getTime()) < 1000) return next.toISOString();
    guess = next;
  }
  return guess.toISOString();
}

function stableScore(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function validatePost(post) {
  if (!post.id || !post.project || !post.category || !post.text) {
    throw new Error(`Invalid content-bank entry: ${JSON.stringify(post)}`);
  }
  const chars = Array.from(post.text).length;
  if (chars > 280) {
    throw new Error(`Post ${post.id} is ${chars} characters; X text must be <= 280 characters in this bank.`);
  }
}

async function loadJson(path) {
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

function choosePost(bank, history, targetDay) {
  const posts = bank.posts.filter((post) => post.enabled !== false);
  posts.forEach(validatePost);

  const recent = (history.posts || []).filter((item) => !item.date || item.date <= targetDay);
  const last = recent
    .filter((item) => item.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const reuseDays = bank.defaultPostReuseDays ?? 90;
  const projectCooldownDays = bank.defaultProjectCooldownDays ?? 3;

  const lastUseById = new Map();
  const lastUseByProject = new Map();
  for (const item of recent) {
    if (item.id && item.date) lastUseById.set(item.id, item.date);
    if (item.project && item.date) lastUseByProject.set(item.project, item.date);
  }

  const dateEligible = posts.filter((post) => {
    if (post.notBefore && targetDay < post.notBefore) return false;
    if (post.notAfter && targetDay > post.notAfter) return false;
    const lastIdUse = lastUseById.get(post.id);
    if (lastIdUse && daysBetween(lastIdUse, targetDay) < (post.reuseDays ?? reuseDays)) return false;
    return true;
  });

  if (!dateEligible.length) {
    throw new Error(`No eligible social posts remain for ${targetDay}. Add content or reduce reuse windows.`);
  }

  let eligible = dateEligible.filter((post) => {
    const lastProjectUse = lastUseByProject.get(post.project);
    if (!lastProjectUse) return true;
    return daysBetween(lastProjectUse, targetDay) >= (post.projectCooldownDays ?? projectCooldownDays);
  });

  if (!eligible.length) eligible = dateEligible;

  const alternateCategory = eligible.filter((post) => !last || post.category !== last.category);
  if (alternateCategory.length) eligible = alternateCategory;

  return eligible
    .map((post) => ({post, score: stableScore(`${targetDay}:${post.id}`)}))
    .sort((a, b) => a.score.localeCompare(b.score))[0].post;
}

function buildWeekPlan(bank, history, startDay, blockedDays = new Set()) {
  const virtualHistory = {posts: [...(history.posts || [])]};
  const slots = [];

  for (let i = 0; i < weeklyPostCount; i += 1) {
    const date = addDays(startDay, i);
    if (blockedDays.has(date)) {
      slots.push({date, skipped: true, reason: 'Buffer already has a scheduled post on this date'});
      continue;
    }

    const post = choosePost(bank, virtualHistory, date);
    const dueAt = localDateTimeToUtc(date, postHour, postMinute);
    slots.push({date, dueAt, post});
    virtualHistory.posts.push({
      id: post.id,
      project: post.project,
      category: post.category,
      date,
      status: 'planned',
    });
  }

  return slots;
}

async function graphql(query, variables = {}) {
  if (!apiKey) throw new Error('BUFFER_API_KEY is required for this action.');
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({query, variables}),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Buffer HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  if (body?.errors?.length) {
    throw new Error(`Buffer GraphQL error: ${body.errors.map((e) => e.message).join('; ')}`);
  }
  return body?.data;
}

async function getChannels() {
  const account = await graphql(`
    query GetOrganizations {
      account {
        organizations { id name }
      }
    }
  `);

  const organizations = account?.account?.organizations || [];
  if (!organizations.length) throw new Error('Buffer returned no organizations.');

  const channels = [];
  for (const organization of organizations) {
    const orgId = JSON.stringify(organization.id);
    const data = await graphql(`
      query GetChannels {
        channels(input: { organizationId: ${orgId} }) {
          id
          name
          service
        }
      }
    `);
    for (const channel of data?.channels || []) {
      channels.push({...channel, organizationId: organization.id, organizationName: organization.name});
    }
  }
  return channels;
}

function selectXChannel(channels) {
  if (explicitChannelId) {
    const channel = channels.find((item) => item.id === explicitChannelId);
    if (!channel) throw new Error(`BUFFER_X_CHANNEL_ID ${explicitChannelId} was not found in Buffer.`);
    return channel;
  }

  const xChannels = channels.filter((item) => /twitter|\bx\b/i.test(String(item.service)));
  if (!xChannels.length) {
    throw new Error(`No X/Twitter channel found. Buffer channels: ${channels.map((c) => `${c.name} (${c.service})`).join(', ')}`);
  }

  const hinted = xChannels.filter((item) => String(item.name).toLowerCase().includes(channelNameHint));
  if (hinted.length === 1) return hinted[0];
  if (xChannels.length === 1) return xChannels[0];

  throw new Error(`Multiple X/Twitter channels found. Set BUFFER_X_CHANNEL_ID. Candidates: ${xChannels.map((c) => `${c.name}=${c.id}`).join(', ')}`);
}

async function getScheduledPosts(organizationId, channelId) {
  const org = JSON.stringify(organizationId);
  const channel = JSON.stringify(channelId);
  const data = await graphql(`
    query GetScheduledPosts {
      posts(
        first: 50
        input: {
          organizationId: ${org}
          filter: { status: [scheduled], channelIds: [${channel}] }
          sort: [{ field: dueAt, direction: asc }]
        }
      ) {
        edges {
          node { id text status dueAt channelId }
        }
      }
    }
  `);
  return (data?.posts?.edges || []).map((edge) => edge.node).filter(Boolean);
}

async function createBufferPost(channelId, text, {saveToDraft = false, dueAt = null, shareNow = false} = {}) {
  const input = {
    text,
    channelId,
    schedulingType: 'automatic',
    mode: dueAt ? 'customScheduled' : (shareNow ? 'shareNow' : 'addToQueue'),
    saveToDraft,
    aiAssisted: true,
  };
  if (dueAt) input.dueAt = dueAt;

  const data = await graphql(`
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post { id text dueAt status }
        }
        ... on MutationError {
          message
        }
      }
    }
  `, {input});

  const payload = data?.createPost;
  if (payload?.message) throw new Error(`Buffer rejected the post: ${payload.message}`);
  if (!payload?.post?.id) throw new Error(`Unexpected Buffer response: ${JSON.stringify(payload)}`);
  return payload.post;
}

function historyEntry(post, date, created, status) {
  const now = new Date().toISOString();
  const entry = {
    id: post.id,
    project: post.project,
    category: post.category,
    date,
    status,
    bufferPostId: created.id,
    textSha256: crypto.createHash('sha256').update(post.text).digest('hex'),
  };
  if (status === 'scheduled') {
    entry.scheduledAt = now;
    entry.dueAt = created.dueAt;
  } else {
    entry.publishedAt = now;
  }
  return entry;
}

async function saveHistory(history) {
  history.posts = (history.posts || []).slice(-500);
  await fs.writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
}

function printWeekPlan(plan) {
  for (const slot of plan) {
    if (slot.skipped) {
      console.log(`${slot.date}: SKIP — ${slot.reason}`);
      continue;
    }
    console.log(`${slot.date} ${postHour.toString().padStart(2, '0')}:${postMinute.toString().padStart(2, '0')} ${timeZone} -> ${slot.post.id} [${slot.post.category} / ${slot.post.project}]`);
    console.log(`  ${slot.post.text}`);
  }
}

async function main() {
  const today = localIsoDay();

  if (action === 'list-channels') {
    const channels = await getChannels();
    console.log('Connected Buffer channels:');
    for (const channel of channels) console.log(`- ${channel.name} | ${channel.service} | ${channel.id}`);
    return;
  }

  const [bank, history] = await Promise.all([loadJson(bankPath), loadJson(historyPath)]);

  if (action === 'preview-week') {
    const startDay = addDays(today, 1);
    const plan = buildWeekPlan(bank, history, startDay);
    console.log(`Previewing ${weeklyPostCount} daily slots starting ${startDay}. Nothing will be sent to Buffer.`);
    printWeekPlan(plan);
    return;
  }

  const selected = choosePost(bank, history, today);
  console.log(`Selected ${selected.id} [${selected.category} / ${selected.project}]`);
  console.log(selected.text);

  if (action === 'dry-run') {
    console.log('Dry run only: nothing sent to Buffer.');
    return;
  }

  const channels = await getChannels();
  const channel = selectXChannel(channels);
  console.log(`Target channel: ${channel.name} (${channel.service}) ${channel.id}`);

  if (action === 'schedule-week') {
    const startDay = addDays(today, 1);
    const existing = await getScheduledPosts(channel.organizationId, channel.id);
    const blockedDays = new Set(existing.filter((post) => post.dueAt).map((post) => localIsoDay(new Date(post.dueAt))));
    const plan = buildWeekPlan(bank, history, startDay, blockedDays);
    console.log(`Buffer currently has ${existing.length} scheduled post(s) for this X channel.`);
    printWeekPlan(plan);

    let createdCount = 0;
    const errors = [];
    for (const slot of plan) {
      if (slot.skipped) continue;
      try {
        const created = await createBufferPost(channel.id, slot.post.text, {dueAt: slot.dueAt});
        console.log(`Scheduled ${slot.post.id} for ${created.dueAt}: ${created.id}`);
        history.posts = [...(history.posts || []), historyEntry(slot.post, slot.date, created, 'scheduled')];
        await saveHistory(history);
        createdCount += 1;
      } catch (error) {
        errors.push(`${slot.date}: ${error.message}`);
        console.error(`Failed to schedule ${slot.date}: ${error.message}`);
      }
    }

    console.log(`Weekly batch complete: ${createdCount} post(s) added to Buffer.`);
    if (errors.length) throw new Error(`Weekly scheduling had ${errors.length} failure(s): ${errors.join(' | ')}`);
    return;
  }

  const saveToDraft = action === 'draft';
  const created = await createBufferPost(channel.id, selected.text, {saveToDraft, shareNow: action === 'publish'});
  console.log(`${saveToDraft ? 'Draft created' : 'Published'} in Buffer: ${created.id}`);

  if (saveToDraft) return;

  history.posts = [...(history.posts || []), historyEntry(selected, today, created, 'published')];
  await saveHistory(history);
  console.log('Updated marketing/posting-history.json.');
}

await main();
