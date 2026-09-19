// ***********************************************************
// This support file is processed and loaded automatically
// before your test files.
// ***********************************************************

import "./commands";
import { registerDatabaseCleanupCommands } from "./dbCleanup";

registerDatabaseCleanupCommands();

// Every spec creates real folders, services and users through the API; purge
// them once the spec has finished so running the suite never leaves fixtures in
// the database. The hook is a no-op when the backend is unreachable.
after(() => {
  cy.purgeTestFixtures();
});
