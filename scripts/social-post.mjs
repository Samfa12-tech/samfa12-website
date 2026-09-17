import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const API_URL = 'https://api.buffer.com';
const bankPath = new URL('../marketing/content-bank.json', import.meta.url);
const historyPath = new URL('../marketing/posting-history.json', import.meta.url);

const action = (process.env.SOCIAL_ACTION || 'dry-run').trim().toLowerCase();
const apiKey = process.env.BUFFER_API_KEY?.trim();
const explicitChannelId = process.env.BUFFER_X_CHANNEL_ID?.trim();
const channelNameHint = (process.env.BUFFER_X_CHANNEL_NAME || 'Samfa12').trim().toLowerCase();

const allowedActions = new Set(['dry-run', 'list-channels', 'draft', 'publish']);
if (!allowedActions.has(action)) {
  throw new Error(`Unsupported SOCIAL_ACTION=${action}. Use dry-run, list-channels, draft, or publish.`);
}

function isoDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
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

function choosePost(bank, history, today) {
  const posts = bank.posts.filter((post) => post.enabled !== false);
  posts.forEach(validatePost);

  const recent = history.posts || [];
  const last = recent.at(-1);
  const reuseDays = bank.defaultPostReuseDays ?? 90;
  const projectCooldownDays = bank.defaultProjectCooldownDays ?? 3;

  const lastUseById = new Map();
  const lastUseByProject = new Map();
  for (const item of recent) {
    if (item.id && item.date) lastUseById.set(item.id, item.date);
    if (item.project && item.date) lastUseByProject.set(item.project, item.date);
  }

  const dateEligible = posts.filter((post) => {
    if (post.notBefore && today < post.notBefore) return false;
    if (post.notAfter && today > post.notAfter) return false;
    const lastIdUse = lastUseById.get(post.id);
    if (lastIdUse && daysBetween(lastIdUse, today) < (post.reuseDays ?? reuseDays)) return false;
    return true;
  });

  if (!dateEligible.length) {
    throw new Error('No eligible social posts remain. Add content or reduce reuse windows.');
  }

  let eligible = dateEligible.filter((post) => {
    const lastProjectUse = lastUseByProject.get(post.project);
    if (!lastProjectUse) return true;
    return daysBetween(lastProjectUse, today) >= (post.projectCooldownDays ?? projectCooldownDays);
  });

  if (!eligible.length) eligible = dateEligible;

  const alternateCategory = eligible.filter((post) => !last || post.category !== last.category);
  if (alternateCategory.length) eligible = alternateCategory;

  return eligible
    .map((post) => ({post, score: stableScore(`${today}:${post.id}`)}))
    .sort((a, b) => a.score.localeCompare(b.score))[0].post;
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

async function createBufferPost(channelId, text, saveToDraft) {
  const data = await graphql(`
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post { id text dueAt }
        }
        ... on MutationError {
          message
        }
      }
    }
  `, {
    input: {
      text,
      channelId,
      schedulingType: 'automatic',
      mode: saveToDraft ? 'addToQueue' : 'shareNow',
      saveToDraft,
      aiAssisted: true,
    },
  });

  const payload = data?.createPost;
  if (payload?.message) throw new Error(`Buffer rejected the post: ${payload.message}`);
  if (!payload?.post?.id) throw new Error(`Unexpected Buffer response: ${JSON.stringify(payload)}`);
  return payload.post;
}

async function main() {
  const today = isoDay();

  if (action === 'list-channels') {
    const channels = await getChannels();
    console.log('Connected Buffer channels:');
    for (const channel of channels) console.log(`- ${channel.name} | ${channel.service} | ${channel.id}`);
    return;
  }

  const [bank, history] = await Promise.all([loadJson(bankPath), loadJson(historyPath)]);
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

  const saveToDraft = action === 'draft';
  const created = await createBufferPost(channel.id, selected.text, saveToDraft);
  console.log(`${saveToDraft ? 'Draft created' : 'Published'} in Buffer: ${created.id}`);

  if (saveToDraft) return;

  const entry = {
    id: selected.id,
    project: selected.project,
    category: selected.category,
    date: today,
    publishedAt: new Date().toISOString(),
    bufferPostId: created.id,
    textSha256: crypto.createHash('sha256').update(selected.text).digest('hex'),
  };

  history.posts = [...(history.posts || []), entry].slice(-500);
  await fs.writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  console.log('Updated marketing/posting-history.json.');
}

await main();
