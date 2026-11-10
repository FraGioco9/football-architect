// ME-01 2D diagnostic pitch: FIFA-style 105 x 68 meter markings.
// Physics lives in XY/Z-up meters; renderer must not affect physical state.
export const PITCH_LENGTH_M = 105;
export const PITCH_WIDTH_M = 68;

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
