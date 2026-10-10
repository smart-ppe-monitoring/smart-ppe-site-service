export const ROLES = {
  ADMIN: "ADMIN",
  SAFETY_MANAGER: "SAFETY_MANAGER",
  SAFETY_OFFICER: "SAFETY_OFFICER",
  // Backward compatibility aliases
  MANAGER: "MANAGER",
  USER: "USER",
} as const;

export type Role = keyof typeof ROLES;

