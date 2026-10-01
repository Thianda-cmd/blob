export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string };

/** A small, dependency-free password strength estimate. */
export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "", hint: "At least 8 characters." };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (/^(.)\1+$/.test(pw) || /^(password|12345678|qwerty)/i.test(pw)) score = 0;
  if (pw.length < 8) score = Math.min(score, 1);

  const s = Math.min(4, score) as Strength["score"];
  const table: Record<Strength["score"], Omit<Strength, "score">> = {
    0: { label: "Too weak", hint: "Make it longer and less predictable." },
    1: { label: "Weak", hint: "Add a few more characters." },
    2: { label: "Okay", hint: "Mix in numbers or symbols." },
    3: { label: "Strong", hint: "Nice one." },
    4: { label: "Very strong", hint: "Rock solid." },
  };
  return { score: s, ...table[s] };
}
