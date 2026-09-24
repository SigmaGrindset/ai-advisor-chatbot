/** What the build is told about where it runs. */
interface ImportMetaEnv {
  /** The backend's origin, when it is on another host. Empty is the page's own. */
  readonly VITE_API_BASE_URL?: string;
  /** Clerk's publishable key. Without one there are no Accounts, only Guests. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}
