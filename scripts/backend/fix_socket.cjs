const fs = require('fs');
let content = fs.readFileSync('src/lib/socket.ts', 'utf8');
content = content.replace(/e\s*x\s*p\s*o\s*r\s*t\s*f\s*u\s*n\s*c\s*t\s*i\s*o\s*n\s*e\s*m\s*i\s*t\s*T\s*o\s*B\s*o\s*a\s*r\s*d\s*L\s*o\s*g\s*s[\s\S]*/, '');
content += `\n
export function emitToBoardLogs(espId: number, logMsg: string): void {
  io?.to(\`board-logs-\${espId}\`).emit("admin:board-log", logMsg);
}
`;
fs.writeFileSync('src/lib/socket.ts', content);
