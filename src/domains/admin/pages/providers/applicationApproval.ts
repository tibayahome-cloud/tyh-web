type ApprovalItem = {
  status: string;
  requirement_type?: { required_for_verification?: boolean } | null;
};

/**
 * Whether an application can be approved: the rule the server applies. Every required document is verified, and nothing
 * the provider did send is left unchecked. An optional document nobody uploaded does not hold approval up.
 */
export const canApproveApplication = (items: ApprovalItem[]): boolean =>
  items.length > 0 &&
  items.every((item) => {
    if (item.status === "verified") return true;
    if (item.requirement_type?.required_for_verification) return false;
    return item.status === "missing";
  });
