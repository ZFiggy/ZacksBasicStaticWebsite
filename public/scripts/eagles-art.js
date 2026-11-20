// Shared canvas characters: the target has a white headband, beard and green #1.
window.drawEaglesFan = (ctx, x, y, size, fan) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 50, size / 50);
    ctx.fillStyle = '#001e2830';
    ctx.beginPath(); ctx.ellipse(25, 60, 19, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = fan.pants || '#dfe5df';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(18, 43); ctx.lineTo(15, 59); ctx.moveTo(32, 43); ctx.lineTo(36, 59); ctx.stroke();
    ctx.fillStyle = fan.jersey;
    ctx.beginPath(); ctx.moveTo(12, 19); ctx.lineTo(2, 30); ctx.lineTo(10, 36); ctx.lineTo(14, 30); ctx.lineTo(12, 47); ctx.lineTo(38, 47); ctx.lineTo(36, 30); ctx.lineTo(40, 36); ctx.lineTo(48, 30); ctx.lineTo(38, 19); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#001e2860'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = fan.jersey === '#edf2ed' ? '#004c54' : '#ffffff';
    ctx.font = '800 18px Arial'; ctx.textAlign = 'center'; ctx.fillText(fan.number.toString(), 25, 40);
    ctx.fillStyle = fan.skin; ctx.beginPath(); ctx.arc(25, 12, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#292329'; ctx.beginPath(); ctx.ellipse(25, 5, 11, 6, 0, Math.PI, Math.PI * 2); ctx.fill();
    if (fan.beard) { ctx.fillStyle = '#302226'; ctx.beginPath(); ctx.arc(25, 14, 9, 0, Math.PI); ctx.fill(); ctx.fillStyle = fan.skin; ctx.fillRect(21, 12, 8, 4); }
    if (fan.headband) { ctx.fillStyle = '#ffffff'; ctx.fillRect(14, 4, 22, 5); }
    if (fan.helmet) { ctx.fillStyle = '#00515a'; ctx.beginPath(); ctx.arc(25, 11, 12, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillRect(13, 8, 6, 11); ctx.strokeStyle = '#e1e9e7'; ctx.lineWidth = 2; ctx.strokeRect(22, 10, 15, 9); }
    ctx.fillStyle = '#24242a'; ctx.fillRect(21, 10, 2, 2); ctx.fillRect(28, 10, 2, 2);
    ctx.restore();
};
