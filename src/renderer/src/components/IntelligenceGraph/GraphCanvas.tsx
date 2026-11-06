import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ProjectGraphNode, ProjectGraphEdge } from '../../../../shared/types';
import { useWorkspaceStore } from '../../stores/workspace.store';

interface GraphCanvasProps {
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: ProjectGraphNode | null) => void;
  showLabels: boolean;
  filterCategory: string | null;
  orphanOnly: boolean;
  searchQuery: string;
  isPhysicsPaused?: boolean;
}

interface SimNode extends ProjectGraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  showLabels,
  filterCategory,
  orphanOnly,
  searchQuery,
  isPhysicsPaused = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { theme, activeOrchestration } = useWorkspaceStore();

  // Viewport transformation: pan (offsetX, offsetY) and zoom scale
  const transformRef = useRef({ x: 0, y: 0, k: 0.95 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Simulation physics state
  const simNodesRef = useRef<Map<string, SimNode>>(new Map());
  const isDraggingRef = useRef(false);
  const dragTargetNodeRef = useRef<string | null>(null);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const isSimActiveRef = useRef(true);
  const alphaRef = useRef(1.0); // Cooling factor
  const animationFrameRef = useRef<number | null>(null);
  const pulsePhaseRef = useRef(0);

  // Filtered nodes and edges
  const visibleNodes = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return nodes.filter((n) => {
      if (filterCategory && n.category !== filterCategory) return false;
      if (orphanOnly && !n.isOrphan) return false;
      if (q && !n.label.toLowerCase().includes(q) && !(n.path && n.path.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [nodes, filterCategory, orphanOnly, searchQuery]);

  const visibleNodeIds = React.useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = React.useMemo(() => {
    return edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [edges, visibleNodeIds]);

  // Connected nodes map for selection isolation / highlighting
  const connectedMap = React.useMemo(() => {
    const targetId = selectedNodeId || hoveredNodeId;
    if (!targetId) return null;
    const connected = new Set<string>([targetId]);
    for (const e of edges) {
      if (e.source === targetId) connected.add(e.target);
      if (e.target === targetId) connected.add(e.source);
    }
    return connected;
  }, [selectedNodeId, hoveredNodeId, edges]);

  // Node category colors
  const getNodeColor = useCallback((node: ProjectGraphNode, isDimmed: boolean) => {
    if (isDimmed) return 'rgba(255, 255, 255, 0.06)';
    if (node.isOrphan) return '#F59E0B'; // Amber for orphans
    switch (node.category) {
      case 'agent':
        return '#FFFFFF';
      case 'task':
        return '#93C5FD'; // Soft blue
      case 'skill':
        return '#A78BFA'; // Soft purple
      case 'context':
        return '#34D399'; // Soft green
      case 'file':
      default:
        if (node.subType === 'config') return '#EAB308';
        if (node.subType === 'document') return '#94A3B8';
        if (node.id.endsWith('.tsx') || node.id.endsWith('.jsx')) return '#38BDF8';
        return '#CBD5E1';
    }
  }, []);

  // Initialize Clustered Radial Placement
  useEffect(() => {
    const simMap = simNodesRef.current;
    const existingCount = simMap.size;

    // Separate by tier for initial placement
    const agents = visibleNodes.filter((n) => n.category === 'agent');
    const skills = visibleNodes.filter((n) => n.category === 'skill');
    const files = visibleNodes.filter((n) => n.category === 'file' || n.category === 'context');

    // Group files by top-level folder
    const folderGroups = new Map<string, ProjectGraphNode[]>();
    for (const f of files) {
      const parts = f.id.replace(/\\/g, '/').split('/');
      const groupKey = parts.length > 1 ? parts[0] : 'root';
      const arr = folderGroups.get(groupKey) || [];
      arr.push(f);
      folderGroups.set(groupKey, arr);
    }

    // Place Agents in center
    agents.forEach((ag, i) => {
      if (!simMap.has(ag.id)) {
        const angle = (i / Math.max(1, agents.length)) * Math.PI * 2;
        simMap.set(ag.id, {
          ...ag,
          x: Math.cos(angle) * 50,
          y: Math.sin(angle) * 50,
          vx: 0,
          vy: 0
        });
      }
    });

    // Place Skills in inner orbit
    skills.forEach((sk, i) => {
      if (!simMap.has(sk.id)) {
        const angle = (i / Math.max(1, skills.length)) * Math.PI * 2;
        simMap.set(sk.id, {
          ...sk,
          x: Math.cos(angle) * 130,
          y: Math.sin(angle) * 130,
          vx: 0,
          vy: 0
        });
      }
    });

    // Place File groups in sectors
    const groupKeys = Array.from(folderGroups.keys());
    groupKeys.forEach((key, gIdx) => {
      const gFiles = folderGroups.get(key) || [];
      const baseAngle = (gIdx / Math.max(1, groupKeys.length)) * Math.PI * 2;
      const angleSpan = (Math.PI * 2) / Math.max(1, groupKeys.length);

      gFiles.forEach((f, fIdx) => {
        if (!simMap.has(f.id)) {
          const subAngle = baseAngle + (fIdx / Math.max(1, gFiles.length)) * angleSpan - angleSpan / 2;
          const radius = 240 + (fIdx % 4) * 45;
          simMap.set(f.id, {
            ...f,
            x: Math.cos(subAngle) * radius,
            y: Math.sin(subAngle) * radius,
            vx: 0,
            vy: 0
          });
        }
      });
    });

    // Remove deleted nodes
    for (const key of Array.from(simMap.keys())) {
      if (!visibleNodeIds.has(key)) {
        simMap.delete(key);
      }
    }

    // Trigger gentle simulation cooling
    alphaRef.current = existingCount === 0 ? 1.0 : 0.4;
    isSimActiveRef.current = true;
  }, [visibleNodes, visibleNodeIds]);

  // Center view on initial load or resize
  const handleResetView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect ? rect.width * dpr : canvas.width;
    const height = rect ? rect.height * dpr : canvas.height;
    transformRef.current = {
      x: width / 2,
      y: height / 2,
      k: 0.95
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleResetView();
    }, 60);
    return () => clearTimeout(timer);
  }, [handleResetView]);

  // Main Render & Controlled Physics Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      pulsePhaseRef.current += 0.03;

      // Handle canvas resizing
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const dpr = window.devicePixelRatio || 1;
        const targetWidth = Math.floor(rect.width * dpr);
        const targetHeight = Math.floor(rect.height * dpr);
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          const isInitial = transformRef.current.x === 0 || transformRef.current.x === 150 || canvas.width === 0;
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          if (isInitial) {
            transformRef.current.x = targetWidth / 2;
            transformRef.current.y = targetHeight / 2;
          }
        }
      }

      const { x: tx, y: ty, k: tk } = transformRef.current;
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const simMap = simNodesRef.current;
      const simList = Array.from(simMap.values());
      const n = simList.length;

      // 1. Controlled Stable Physics Step
      if (!isPhysicsPaused && isSimActiveRef.current && n > 0 && alphaRef.current > 0.015) {
        const alpha = alphaRef.current;
        const repulsionStrength = 800 * alpha;
        const springLength = 85;
        const springStiffness = 0.03 * alpha;
        const centerGravity = 0.008 * alpha;

        // Node-node repulsion with clamped distance and force limits
        for (let i = 0; i < n; i++) {
          const a = simList[i];
          for (let j = i + 1; j < n; j++) {
            const b = simList[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.max(45, Math.sqrt(distSq));
            if (dist < 320) {
              const rawForce = repulsionStrength / (dist * dist);
              const force = Math.min(5, rawForce);
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              a.vx -= fx;
              a.vy -= fy;
              b.vx += fx;
              b.vy += fy;
            }
          }

          // Gentle center gravity
          a.vx -= a.x * centerGravity;
          a.vy -= a.y * centerGravity;
        }

        // Spring attraction along edges
        for (const edge of visibleEdges) {
          const src = simMap.get(edge.source);
          const tgt = simMap.get(edge.target);
          if (src && tgt) {
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            const force = Math.min(6, Math.max(-6, (dist - springLength) * springStiffness));
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            src.vx += fx;
            src.vy += fy;
            tgt.vx -= fx;
            tgt.vy -= fy;
          }
        }

        // Apply velocity with high damping and speed limits
        for (const node of simList) {
          if (dragTargetNodeRef.current === node.id) {
            node.vx = 0;
            node.vy = 0;
            continue;
          }
          // Clamp velocity to prevent jitter or catapulting
          node.vx = Math.max(-3.5, Math.min(3.5, node.vx * 0.65));
          node.vy = Math.max(-3.5, Math.min(3.5, node.vy * 0.65));
          node.x += node.vx;
          node.y += node.vy;
        }

        // Exponential cooling: smoothly settle into frozen rock-solid layout
        alphaRef.current *= 0.975;
        if (alphaRef.current < 0.015 && !isDraggingRef.current) {
          isSimActiveRef.current = false;
        }
      }

      // Apply viewport transform
      ctx.translate(tx, ty);
      ctx.scale(tk, tk);

      // 2. Draw Edges
      const isGlass = theme !== 'solid';
      const baseEdgeColor = isGlass ? 'rgba(255, 255, 255, 0.08)' : 'rgba(80, 80, 80, 0.35)';
      const highlightedEdgeColor = 'rgba(255, 255, 255, 0.75)';

      for (const edge of visibleEdges) {
        const src = simMap.get(edge.source);
        const tgt = simMap.get(edge.target);
        if (!src || !tgt) continue;

        const isHighlighted =
          connectedMap !== null && (connectedMap.has(edge.source) && connectedMap.has(edge.target));
        const isDimmed = connectedMap !== null && !isHighlighted;
        const isActiveExecution = edge.isActive || (activeOrchestration && (src.category === 'agent' || tgt.category === 'agent'));

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);

        if (isActiveExecution) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -pulsePhaseRef.current * 15;
        } else if (isHighlighted) {
          ctx.strokeStyle = highlightedEdgeColor;
          ctx.lineWidth = 1.4;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = isDimmed ? 'rgba(255, 255, 255, 0.02)' : baseEdgeColor;
          ctx.lineWidth = 0.8;
          ctx.setLineDash([]);
        }
        ctx.stroke();

        // Traveling pulse particle on active execution edge
        if (isActiveExecution) {
          const t = (Math.sin(pulsePhaseRef.current * 2) + 1) / 2;
          const px = src.x + (tgt.x - src.x) * t;
          const py = src.y + (tgt.y - src.y) * t;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
        }
      }

      // 3. Draw Nodes
      for (const node of simList) {
        const isSelected = node.id === selectedNodeId;
        const isHovered = node.id === hoveredNodeId;
        const isConnected = connectedMap === null || connectedMap.has(node.id);
        const isDimmed = connectedMap !== null && !isConnected;

        const baseRadius = node.category === 'agent' ? 14 : node.category === 'skill' ? 10 : 6;
        const radius = isSelected || isHovered ? baseRadius * 1.3 : baseRadius;
        const color = getNodeColor(node, isDimmed);

        // Ambient outer glow for selected/hovered nodes
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fill();
        }

        // Main node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Delicate stroke
        ctx.strokeStyle = isSelected ? '#FFFFFF' : isDimmed ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();
      }

      // 4. Draw Legible Selective Labels with Dark Glass Backing
      if (showLabels) {
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const node of simList) {
          const isSelected = node.id === selectedNodeId;
          const isHovered = node.id === hoveredNodeId;
          const isConnected = connectedMap !== null && connectedMap.has(node.id);
          const isKeyNode = node.category === 'agent' || node.category === 'skill' || (node.degree && node.degree > 6);

          // Only render labels selectively to avoid chaotic overlapping
          const shouldRenderLabel =
            isSelected ||
            isHovered ||
            isConnected ||
            (isKeyNode && connectedMap === null) ||
            tk > 1.35; // show all when zoomed in

          if (!shouldRenderLabel) continue;

          const labelText = node.label;
          const metrics = ctx.measureText(labelText);
          const paddingX = 5;
          const paddingY = 2.5;
          const pillW = metrics.width + paddingX * 2;
          const pillH = 15;
          const pillX = node.x - pillW / 2;
          const pillY = node.y + (node.category === 'agent' ? 18 : 10);

          // Dark pill background
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(pillX, pillY, pillW, pillH, 4);
          } else {
            ctx.rect(pillX, pillY, pillW, pillH);
          }
          ctx.fillStyle = isSelected
            ? 'rgba(30, 32, 36, 0.95)'
            : isHovered || isConnected
            ? 'rgba(20, 22, 25, 0.90)'
            : 'rgba(16, 17, 19, 0.85)';
          ctx.fill();

          ctx.strokeStyle = isSelected
            ? 'rgba(255, 255, 255, 0.4)'
            : isHovered || isConnected
            ? 'rgba(255, 255, 255, 0.2)'
            : 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // Text label
          ctx.fillStyle = isSelected
            ? '#FFFFFF'
            : isHovered || isConnected
            ? '#ECEDEF'
            : '#A4A8AF';
          ctx.fillText(labelText, node.x, pillY + pillH / 2);
        }
      }

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [visibleEdges, selectedNodeId, hoveredNodeId, connectedMap, showLabels, theme, getNodeColor, activeOrchestration, isPhysicsPaused]);

  // Screen -> World conversion
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const canvasX = (screenX - rect.left) * dpr;
    const canvasY = (screenY - rect.top) * dpr;
    const { x: tx, y: ty, k: tk } = transformRef.current;
    return {
      x: (canvasX - tx) / tk,
      y: (canvasY - ty) / tk
    };
  }, []);

  // Hit test
  const hitTestNode = useCallback(
    (worldX: number, worldY: number) => {
      const simMap = simNodesRef.current;
      for (const node of simMap.values()) {
        const dx = node.x - worldX;
        const dy = node.y - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = node.category === 'agent' ? 18 : 12;
        if (dist <= radius) {
          return node;
        }
      }
      return null;
    },
    []
  );

  // Mouse Interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const hit = hitTestNode(worldPos.x, worldPos.y);

    if (hit) {
      dragTargetNodeRef.current = hit.id;
      isDraggingRef.current = true;
      isSimActiveRef.current = true;
      alphaRef.current = Math.max(alphaRef.current, 0.3); // Re-energize slightly
    } else {
      isDraggingRef.current = true;
      dragTargetNodeRef.current = null;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    const dpr = window.devicePixelRatio || 1;

    if (isDraggingRef.current) {
      if (dragTargetNodeRef.current) {
        const node = simNodesRef.current.get(dragTargetNodeRef.current);
        if (node) {
          node.x += (dx * dpr) / transformRef.current.k;
          node.y += (dy * dpr) / transformRef.current.k;
          isSimActiveRef.current = true;
        }
      } else {
        transformRef.current.x += dx * dpr;
        transformRef.current.y += dy * dpr;
      }
    } else {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const hit = hitTestNode(worldPos.x, worldPos.y);
      setHoveredNodeId(hit ? hit.id : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only register a click selection if total distance from mouseDown is small
    const distMoved = Math.hypot(
      e.clientX - mouseDownPosRef.current.x,
      e.clientY - mouseDownPosRef.current.y
    );

    if (distMoved < 6) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const hit = hitTestNode(worldPos.x, worldPos.y);
      onSelectNode(hit);
    }

    isDraggingRef.current = false;
    dragTargetNodeRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mouseX = (e.clientX - rect.left) * dpr;
    const mouseY = (e.clientY - rect.top) * dpr;

    const { x, y, k } = transformRef.current;
    const newK = Math.max(0.2, Math.min(3.5, k * zoomFactor));

    transformRef.current = {
      x: mouseX - (mouseX - x) * (newK / k),
      y: mouseY - (mouseY - y) * (newK / k),
      k: newK
    };
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden select-none cursor-grab active:cursor-grabbing bg-transparent"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full block"
      />
    </div>
  );
};

export default GraphCanvas;
