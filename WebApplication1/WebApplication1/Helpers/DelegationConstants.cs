namespace WebApplication1.Helpers
{
    /// <summary>
    /// Names shared by the delegation middleware, the trace and the clients that
    /// enter a replacement workspace (see <c>DelegationImpersonationMiddleware</c>).
    /// </summary>
    public static class DelegationConstants
    {
        /// <summary>
        /// Request header naming the agent whose account is being worked as. Sent
        /// while a substitute is inside the replacement workspace.
        /// </summary>
        public const string HeaderName = "X-Delegation-User-Id";

        /// <summary>Claim holding the real caller's id when the principal was swapped.</summary>
        public const string OriginalUserClaim = "original_user_id";

        /// <summary>Claim holding the id of the delegation being used.</summary>
        public const string DelegationIdClaim = "delegation_id";
    }
}
