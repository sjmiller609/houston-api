export default `fragment EnsureFields on ServiceAccount {
  id
  roleBinding {
    role
    deployment { id }
  }
}
`;
