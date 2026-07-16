import {
  Braces,
  CircleDot,
  GitBranch,
  ListChecks,
  ShieldAlert,
  Square,
  Target,
} from 'lucide-react';

export const icons = {
  CONDITION: GitBranch,
  EXPRESSION: Braces,
  DECISION_TABLE: ListChecks,
  MANUAL_REVIEW: ShieldAlert,
  START: CircleDot,
  END: CircleDot,
  ACTION: Square,
  SCORE: Braces,
  RESULT: Target,
} as const;

export const NODE_TYPES = Object.keys(icons);
