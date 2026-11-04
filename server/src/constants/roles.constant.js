export const WORKSPACE_ROLES = Object.freeze({
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
});

export const ALL_WORKSPACE_ROLES = Object.values(WORKSPACE_ROLES);
export const PRIVILEGED_WORKSPACE_ROLES = [WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN];

