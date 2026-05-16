/**
 * Trust graph: nodes = people (size ~ trust score), edges = vouches.
 * Plain DOM/SVG — no dependencies.
 */

(function () {
  "use strict";

  const MOCK_PEOPLE = [
    {
      id: "1",
      displayName: "Alex Rivera",
      role: "Community organizer",
      trustScore: 68,
    },
    {
      id: "2",
      displayName: "Jordan Lee",
      role: "Software engineer",
      trustScore: 88,
    },
    {
      id: "3",
      displayName: "Sam Okonkwo",
      role: "High school teacher",
      trustScore: 61,
    },
    {
      id: "4",
      displayName: "Casey Nguyen",
      role: "UX designer",
      trustScore: 92,
    },
    {
      id: "5",
      displayName: "Morgan Patel",
      role: "Registered nurse",
      trustScore: 74,
    },
    {
      id: "6",
      displayName: "Riley Chen",
      role: "Journalist",
      trustScore: 79,
    },
  ];

  /** Each vouch is a directed edge: `from` socially attests `to` for `attestedRole`. */
  const MOCK_VOUCHES = [
    { fromId: "2", toId: "1", attestedRole: "Community organizer" },
    { fromId: "3", toId: "1", attestedRole: "Community organizer" },
    { fromId: "4", toId: "1", attestedRole: "Community organizer" },
    { fromId: "6", toId: "1", attestedRole: "Community organizer" },
    { fromId: "5", toId: "2", attestedRole: "Software engineer" },
    { fromId: "4", toId: "6", attestedRole: "Journalist" },
  ];

  const VIEW_W = 800;
  const VIEW_H = 520;
  const CENTER_X = VIEW_W / 2;
  const CENTER_Y = VIEW_H / 2;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function nodeRadius(trustScore) {
    const t = clamp(Number(trustScore) || 0, 0, 100);
    return 14 + (t / 100) * 26;
  }

  function buildSubgraph(centerId, centerPatch) {
    const peopleById = new Map(MOCK_PEOPLE.map((p) => [p.id, { ...p }]));
    if (!peopleById.has(centerId)) {
      return { nodes: [], links: [], center: null };
    }

    const involved = new Set([centerId]);
    for (const v of MOCK_VOUCHES) {
      if (v.toId === centerId || v.fromId === centerId) {
        involved.add(v.fromId);
        involved.add(v.toId);
      }
    }

    const nodes = [...involved]
      .map((id) => peopleById.get(id))
      .filter(Boolean)
      .map((p, i) => {
        const patched =
          centerPatch && p.id === centerId
            ? {
                ...p,
                displayName: centerPatch.displayName || p.displayName,
                role: centerPatch.role || p.role,
              }
            : { ...p };
        const angle = (i / Math.max(involved.size, 1)) * Math.PI * 2;
        const spread = patched.id === centerId ? 0 : 200;
        return {
          ...patched,
          x: CENTER_X + Math.cos(angle) * spread,
          y: CENTER_Y + Math.sin(angle) * spread,
          vx: 0,
          vy: 0,
        };
      });

    const links = MOCK_VOUCHES.filter(
      (e) => involved.has(e.fromId) && involved.has(e.toId)
    ).map((e) => ({
      source: nodes.find((n) => n.id === e.fromId),
      target: nodes.find((n) => n.id === e.toId),
      attestedRole: e.attestedRole,
    })).filter((l) => l.source && l.target);

    const center = nodes.find((n) => n.id === centerId) || null;
    return { nodes, links, center };
  }

  function runLayout(nodes, links, centerId, steps) {
    const centerNode = nodes.find((n) => n.id === centerId);
    if (!centerNode) {
      return;
    }

    const kRepel = 4200;
    const kAttract = 0.045;
    const idealLen = 168;

    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const force = kRepel / (dist * dist);
          dx = (dx / dist) * force;
          dy = (dy / dist) * force;
          if (a.id !== centerId) {
            a.vx -= dx;
            a.vy -= dy;
          }
          if (b.id !== centerId) {
            b.vx += dx;
            b.vy += dy;
          }
        }
      }

      for (const link of links) {
        const a = link.source;
        const b = link.target;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const delta = dist - idealLen;
        const force = delta * kAttract;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        if (a.id !== centerId) {
          a.vx += dx;
          a.vy += dy;
        }
        if (b.id !== centerId) {
          b.vx -= dx;
          b.vy -= dy;
        }
      }

      const friction = 0.82;
      for (const n of nodes) {
        if (n.id === centerId) {
          n.x = CENTER_X;
          n.y = CENTER_Y;
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx *= friction;
        n.vy *= friction;
        n.x += n.vx;
        n.y += n.vy;
        n.x = clamp(n.x, 40, VIEW_W - 40);
        n.y = clamp(n.y, 40, VIEW_H - 40);
      }
    }
  }

  function aggregateConfidence(centerId) {
    const { nodes, links } = buildSubgraph(centerId);
    if (!nodes.length) {
      return { score: 0, count: 0 };
    }
    const incoming = links.filter((l) => l.target.id === centerId);
    const direct = incoming.length;
    if (direct === 0) {
      return { score: 0, count: 0 };
    }
    const avgEndorserTrust =
      incoming.reduce((acc, l) => acc + l.source.trustScore, 0) / direct;
    const score = Math.round(avgEndorserTrust * 0.65 + Math.min(direct * 6, 34));
    return { score: clamp(score, 0, 100), count: direct };
  }

  function createSvgEl(name, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, String(v));
      }
    }
    return el;
  }

  function renderTrustGraph(rootEl, centerPersonId, options) {
    if (!rootEl) {
      return;
    }

    const centerId = String(centerPersonId || "1");
    const centerPatch = options && options.centerPatch ? options.centerPatch : null;
    const { nodes, links, center } = buildSubgraph(centerId, centerPatch);

    rootEl.innerHTML = "";

    if (!center || nodes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "trust-graph-empty";
      empty.textContent = "No trust graph data for this profile yet.";
      rootEl.appendChild(empty);
      return;
    }

    runLayout(nodes, links, centerId, 96);

    const svg = createSvgEl("svg", {
      class: "trust-graph-svg",
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      role: "img",
      "aria-label": "Trust network graph",
    });

    const defs = createSvgEl("defs");
    const grad = createSvgEl("radialGradient", { id: "tg-node-glow" });
    grad.appendChild(
      createSvgEl("stop", { offset: "0%", "stop-color": "#5cff68", "stop-opacity": "0.55" })
    );
    grad.appendChild(
      createSvgEl("stop", { offset: "70%", "stop-color": "#1a3320", "stop-opacity": "0.2" })
    );
    grad.appendChild(createSvgEl("stop", { offset: "100%", "stop-color": "#000000", "stop-opacity": "0" }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    const edgeGroup = createSvgEl("g", { class: "trust-graph-edges" });
    const nodeGroup = createSvgEl("g", { class: "trust-graph-nodes" });

    for (const link of links) {
      const line = createSvgEl("line", {
        x1: link.source.x,
        y1: link.source.y,
        x2: link.target.x,
        y2: link.target.y,
        class: "trust-graph-edge",
      });
      const tip =
        link.target.id === centerId
          ? `${link.source.displayName} vouches for ${link.target.displayName} as ${link.attestedRole}`
          : `${link.source.displayName} vouches for ${link.target.displayName} (${link.attestedRole})`;
      const edgeTitle = createSvgEl("title");
      edgeTitle.textContent = tip;
      line.appendChild(edgeTitle);
      edgeGroup.appendChild(line);
    }

    for (const n of nodes) {
      const g = createSvgEl("g", { class: "trust-graph-node", tabindex: "0" });
      const r = nodeRadius(n.trustScore);
      const isCenter = n.id === centerId;

      const halo = createSvgEl("circle", {
        cx: n.x,
        cy: n.y,
        r: r + (isCenter ? 10 : 6),
        class: "trust-graph-halo",
      });

      const disc = createSvgEl("circle", {
        cx: n.x,
        cy: n.y,
        r,
        class: isCenter ? "trust-graph-dot trust-graph-dot-center" : "trust-graph-dot",
      });

      const label = createSvgEl("text", {
        x: n.x,
        y: n.y + r + 18,
        class: "trust-graph-label",
        "text-anchor": "middle",
      });
      label.textContent = n.displayName.split(" ")[0];

      const sub = createSvgEl("text", {
        x: n.x,
        y: n.y + r + 34,
        class: "trust-graph-sublabel",
        "text-anchor": "middle",
      });
      sub.textContent = n.role.length > 22 ? `${n.role.slice(0, 20)}…` : n.role;

      const scoreLbl = createSvgEl("text", {
        x: n.x,
        y: n.y + 4,
        class: "trust-graph-score",
        "text-anchor": "middle",
      });
      scoreLbl.textContent = String(n.trustScore);

      const hint = createSvgEl("title");
      hint.textContent = `${n.displayName} — ${n.role}. Trust index ${n.trustScore}.`;
      g.appendChild(hint);

      g.appendChild(halo);
      g.appendChild(disc);
      g.appendChild(label);
      g.appendChild(sub);
      g.appendChild(scoreLbl);

      nodeGroup.appendChild(g);
    }

    svg.appendChild(edgeGroup);
    svg.appendChild(nodeGroup);
    rootEl.appendChild(svg);
  }

  window.TrustGraph = {
    MOCK_PEOPLE,
    MOCK_VOUCHES,
    renderTrustGraph,
    aggregateConfidence,
  };
})();
