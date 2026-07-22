export interface TutorialStep {
  title: string;
  body: string;
  /** Optional highlighted aside — a gotcha, shortcut or best practice. */
  tip?: string;
}

export interface Tutorial {
  /** Small kicker above the title, e.g. "Motor de decisión · Diseño". */
  eyebrow: string;
  /** Tool name shown as the tutorial heading. */
  title: string;
  /** One sentence: what the tool is for. */
  intro: string;
  steps: readonly TutorialStep[];
}

/** Tutorials keyed by route path (detail routes fall back to the longest prefix). */
export type TutorialRegistry = Readonly<Record<string, Tutorial>>;
