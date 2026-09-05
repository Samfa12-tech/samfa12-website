/** Own only the pause raised for one host boundary operation. */
export function createCoopBoundaryPauseScopes() {
  const activeTokens = new Set();
  let acquiredAuthorityPause = false;
  return {
    pause(coop, reason) {
      if (!isConnectedHost(coop)) return null;
      const token = Symbol(reason);
      activeTokens.add(token);
      if (activeTokens.size === 1) {
        acquiredAuthorityPause = !coop.authorityPaused;
        if (acquiredAuthorityPause) coop.setAuthorityPaused(true, reason);
      }
      return token;
    },
    release(coop, token) {
      if (!token || !activeTokens.delete(token)) return false;
      if (activeTokens.size > 0) return true;
      const shouldResume = acquiredAuthorityPause;
      acquiredAuthorityPause = false;
      if (shouldResume && isConnectedHost(coop)) coop.setAuthorityPaused(false);
      return true;
    },
  };
}

export async function startWithCoopBoundaryPause(scopes, coop, start, reason = "wave_boundary") {
  const token = scopes.pause(coop, reason);
  try {
    return await start();
  } finally {
    scopes.release(coop, token);
  }
}

function isConnectedHost(coop) {
  return coop?.role === "host" && coop.connected === true;
}
