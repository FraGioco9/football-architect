// ME-01 2D diagnostic pitch: FIFA-style 105 x 68 meter markings.
// Physics lives in XY/Z-up meters; renderer must not affect physical state.
export const PITCH_LENGTH_M = 105;
export const PITCH_WIDTH_M = 68;

// Presentation-only marker sizes in the original canvas coordinate space.
// Physical player and ball dimensions remain in their Rapier modules.
export const LAB_MARKER_RADII_PX=Object.freeze({
 player:10,goalkeeper:11,pressing:11.5,ball:4.5
});

// Height is the authentic underside clearance in metres. The upward
// screen offset is a visual cue, not a change to the pitch XY projection.
// Keep the ground footprint fixed, and cap the cue at high elevations or
// near the upper edge; the numeric label always conveys the real height.
export function labBallMarkerGeometry(width,height,position,clearanceM){
 if(!position||![position.x,position.y,clearanceM].every(Number.isFinite)||clearanceM<0)
  throw new TypeError('Finite observed ball XY and clearance required');
 const {X,Y}=pitchProjection(width,height);
 const groundX=X(position.x),groundY=Y(position.y);
 const airborne=clearanceM>=0.10;
 const radius=LAB_MARKER_RADII_PX.ball;
 const liftPx=airborne?Math.min(60,clearanceM*8,Math.max(0,groundY-radius-2)):0;
 return Object.freeze({groundX,groundY,x:groundX,y:groundY-liftPx,radius,
  airborne,clearanceM,liftPx});
}

export function drawLabBallMarker(ctx,width,height,position,clearanceM){
 const b=labBallMarkerGeometry(width,height,position,clearanceM);
 ctx.save();
 if(b.airborne){
  // The ground shadow and tether are anchored to true XY. No predicted
  // landing point or simulated shadow direction is implied.
  ctx.fillStyle='rgba(0,0,0,0.42)';
  ctx.beginPath();ctx.ellipse(b.groundX,b.groundY,6,3.5,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.78)';ctx.lineWidth=1.25;
  ctx.beginPath();ctx.moveTo(b.groundX,b.groundY);ctx.lineTo(b.x,b.y);ctx.stroke();
 }
 ctx.fillStyle='#ffffff';ctx.strokeStyle='#202f2b';ctx.lineWidth=1.5;
 ctx.beginPath();ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);ctx.fill();ctx.stroke();
 if(b.airborne){
  const label=b.clearanceM.toFixed(2)+' m';
  ctx.font='bold 12px system-ui';ctx.textBaseline='middle';
  const labelWidth=ctx.measureText(label).width;
  const labelX=b.x+12+labelWidth<=width-4?b.x+12:Math.max(4,b.x-12-labelWidth);
  ctx.textAlign='left';
  const labelY=Math.max(9,Math.min(height-9,b.y));
  ctx.lineWidth=3;ctx.strokeStyle='#102d2e';ctx.strokeText(label,labelX,labelY);
  ctx.fillStyle='#ffffff';ctx.fillText(label,labelX,labelY);
 }
 ctx.restore();
 return b;
}

export function pitchProjection(width, height, padding = 22) {
  if (![width, height, padding].every(Number.isFinite) ||
      width <= padding * 2 || height <= padding * 2 || padding < 0)
    throw new RangeError('Invalid pitch canvas size');
  const scale = Math.min((width - 2 * padding) / PITCH_LENGTH_M,
    (height - 2 * padding) / PITCH_WIDTH_M);
  return Object.freeze({
    scale,
    X: x => width / 2 + x * scale,
    Y: y => height / 2 + y * scale,
    R: meters => meters * scale
  });
}

// ME-PLAYER-28: read-only hit testing against the SAME pitch projection
// used to draw real players. Returns a body ID, never a motion instruction.
export function pickObservedPlayerAtCanvasPixel(players,pixelX,pixelY,
  width,height,radiusPx=14){
 const projection=pitchProjection(width,height);
 if(!Array.isArray(players)||players.length!==22||
    ![pixelX,pixelY,radiusPx].every(Number.isFinite)||
    radiusPx<=0||radiusPx>100)
  throw new TypeError('22 actual bodies and finite canvas pointer/radius required');
 if(pixelX<0||pixelY<0||pixelX>width||pixelY>height)return null;
 let closestId=null,bestDist2=radiusPx*radiusPx;
 for(const p of players){
  if(!p||typeof p.id!=='string'||!['home','away'].includes(p.team)||
     !Number.isFinite(p.x)||!Number.isFinite(p.y))
   throw new TypeError('Finite real player XY required');
  const dx=projection.X(p.x)-pixelX,dy=projection.Y(p.y)-pixelY;
  const d=dx*dx+dy*dy;
  if(d<=bestDist2){
   bestDist2=d;closestId=p.id;
  }
 }
 return closestId;
}
export function drawPitchMarkings(ctx, width, height) {
  const { X, Y, R } = pitchProjection(width, height);
  const centerX = X(0), centerY = Y(0);
  const halfLength = PITCH_LENGTH_M / 2; // 52.5 m
  const halfWidth = PITCH_WIDTH_M / 2; // 34 m
  ctx.fillStyle = '#1b6145';
  ctx.fillRect(0, 0, width, height);
  for (let band = 0; band < 10; band++) {
    if (band % 2 === 0) {
      ctx.fillStyle = '#ffffff08';
      ctx.fillRect(X(-halfLength + band * 10.5), Y(-halfWidth),
        R(10.5), R(PITCH_WIDTH_M));
    }
  }
  ctx.strokeStyle = '#e5f7e9';
  ctx.lineWidth = Math.max(1.8, R(0.19));
  ctx.lineJoin = 'round';

  // Touchlines, goal lines, halfway line, center circle.
  ctx.strokeRect(X(-halfLength), Y(-halfWidth), R(PITCH_LENGTH_M), R(PITCH_WIDTH_M));
  ctx.beginPath();
  ctx.moveTo(centerX, Y(-halfWidth));
  ctx.lineTo(centerX, Y(halfWidth));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, centerY, R(9.15), 0, Math.PI * 2);
  ctx.stroke();

  // Penalty and goal areas: 16.5 m / 5.5 m deep, centered on 7.32 m goal.
  for (const sign of [-1, 1]) {
    const goalLine = sign * halfLength;
    const penaltyInner = goalLine - sign * 16.5;
    const goalAreaInner = goalLine - sign * 5.5;
    ctx.strokeRect(X(Math.min(goalLine, penaltyInner)), Y(-20.16), R(16.5), R(40.32));
    ctx.strokeRect(X(Math.min(goalLine, goalAreaInner)), Y(-9.16), R(5.5), R(18.32));

    // Penalty marks, 11 m from the goal line.
    const spotX = X(goalLine - sign * 11);
    ctx.fillStyle = '#e5f7e9';
    ctx.beginPath();
    ctx.arc(spotX, centerY, Math.max(1.8, R(0.15)), 0, Math.PI * 2);
    ctx.fill();

    // Only the part of the 9.15m penalty arc OUTSIDE the penalty area.
    const outsideAngle = Math.acos(5.5 / 9.15);
    ctx.beginPath();
    if (sign === -1)
      ctx.arc(spotX, centerY, R(9.15), -outsideAngle, outsideAngle);
    else
      ctx.arc(spotX, centerY, R(9.15), Math.PI - outsideAngle, Math.PI + outsideAngle);
    ctx.stroke();

    // Goal frame behind goal line (7.32m wide, 2m deep).
    ctx.strokeRect(X(Math.min(goalLine, goalLine + sign * 2)), Y(-3.66), R(2), R(7.32));
  }

  // Four 1m corner arcs, inside the lines of play.
  const corners = [
    [-halfLength, -halfWidth, 0, Math.PI / 2],
    [halfLength, -halfWidth, Math.PI / 2, Math.PI],
    [halfLength, halfWidth, Math.PI, Math.PI * 1.5],
    [-halfLength, halfWidth, Math.PI * 1.5, Math.PI * 2]
  ];
  for (const [x, y, begin, end] of corners) {
    ctx.beginPath();
    ctx.arc(X(x), Y(y), R(1), begin, end);
    ctx.stroke();
  }

  // Center mark.
  ctx.fillStyle = '#e5f7e9';
  ctx.beginPath();
  ctx.arc(centerX, centerY, Math.max(1.8, R(0.15)), 0, Math.PI * 2);
  ctx.fill();

  return { X, Y };
}
