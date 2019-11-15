export const queryUserFragment = `fragment EnsureFields on User {
  roleBindings {
    role
  }
}`;

export const returnUserFragment = `fragment EnsureFields on User {
  id
}`;
