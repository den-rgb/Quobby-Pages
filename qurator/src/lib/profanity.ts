const BLOCKED_PATTERNS = [
  /\b(f+u+c+k+|f+[*@#]+c*k*)\w*/gi,
  /\b(s+h+i+t+|s+h+[*@#]+t*)\w*/gi,
  /\b(a+s+s+h+o+l+e*|a+s+s+h+[*@#]+l+e*)\w*/gi,
  /\bb+i+t+c+h+\w*/gi,
  /\bd+i+c+k+\w*/gi,
  /\bc+u+n+t+\w*/gi,
  /\b(n+i+g+g+[ae]+r*|n+[*@#]+g+[ae]*r*)\w*/gi,
  /\bf+a+g+g*[oi]*t*\w*/gi,
  /\b(r+e+t+a+r+d+)\w*/gi,
  /\bw+h+o+r+e+\w*/gi,
  /\b(d+a+m+n+|d+[*@#]+m+n*)\w*/gi,
  /\b(c+r+a+p+)\w*/gi,
  /\bp+i+s+s+\w*/gi,
  /\bb+a+s+t+a+r+d+\w*/gi,
  /\bt+w+a+t+\w*/gi,
  /\bw+a+n+k+\w*/gi,
  /\bk+i+l+l\s*(your|ur)?\s*self/gi,
  /\bk+y+s+\b/gi,
  /\bs+t+f+u+\b/gi,
];

export function containsProfanity(text: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

export function filterProfanity(text: string): string {
  let filtered = text;
  for (const pattern of BLOCKED_PATTERNS) {
    filtered = filtered.replace(pattern, (match) => '*'.repeat(match.length));
  }
  return filtered;
}
