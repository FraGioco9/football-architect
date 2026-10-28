export function renderAdminSettings(){
 return `<section class="app-panel app-settings-panel admin-settings" data-admin-settings aria-labelledby="admin-heading">
 <h2 id="admin-heading" data-admin-copy="title">World administration</h2>
 <div class="app-settings-panel-content">
 <p data-admin-copy="intro">Public access does not require an account. Operators sign in here to manage the shared world.</p>
 <p data-admin-status role="status" aria-live="polite">Checking access…</p>
 <form data-admin-login>
 <label for="admin-email" data-admin-copy="email">Email</label>
 <input id="admin-email" name="email" type="email" autocomplete="username" required maxlength="254">
 <label for="admin-password" data-admin-copy="password">Password</label>
 <input id="admin-password" name="password" type="password" autocomplete="current-password" required maxlength="256">
 <button type="submit" data-admin-copy="signIn">Sign in</button>
 </form>
 <div data-admin-signed-in hidden>
 <p data-admin-actor></p><p data-admin-world></p>
 <button type="button" data-admin-prepare data-admin-copy="prepare">Prepare season</button>
 <button type="button" data-admin-refresh data-admin-copy="refresh">Refresh</button>
 </div>
 <button type="button" data-admin-logout data-admin-copy="signOut" hidden>Sign out</button>
 </div></section>`;
}
