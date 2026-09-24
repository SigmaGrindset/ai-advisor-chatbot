/** What the build is told about where it runs. */
interface ImportMetaEnv {
  /** The backend's origin, when it is on another host. Empty is the page's own. */
  readonly VITE_API_BASE_URL?: string;
}
