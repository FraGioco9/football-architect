/** Generated Admin Contracts page content. Data loads only after Admin authorization. */
export function renderAdminContracts(){
 return '<section class="app-panel app-settings-panel admin-settings admin-contracts" data-admin-contracts hidden aria-labelledby="admin-contracts-heading">'+
  '<h2 id="admin-contracts-heading" data-contracts-copy="heading">Player–club affiliations</h2>'+
  '<p data-contracts-copy="intro">One current club per persisted player. No durations, salaries or fees.</p>'+
  '<div class="admin-contracts-toolbar"><form data-contracts-search-form autocomplete="off">'+
   '<label for="admin-contract-id" data-contracts-copy="findLabel">Player ID</label>'+
   '<input id="admin-contract-id" type="text" inputmode="numeric" data-contracts-find-input placeholder="Player ID">'+
   '<button type="submit" class="app-link app-link-primary" data-contracts-copy="find">Find</button>'+
   '<button type="button" class="app-link app-link-secondary" data-contracts-clear data-contracts-copy="all">All players</button>'+
  '</form><span data-contracts-total aria-live="polite"></span></div>'+
  '<div class="admin-contracts-table-scroll" role="region" aria-label="Player contracts" tabindex="0">'+
   '<table class="admin-contracts-table"><thead><tr><th scope="col" data-contracts-copy="id">ID</th>'+
   '<th scope="col" data-contracts-copy="player">Player</th><th scope="col" data-contracts-copy="club">Club</th>'+
   '<th scope="col" data-contracts-copy="action">Action</th></tr></thead>'+
   '<tbody data-contracts-rows aria-busy="true">'+
    Array.from({length:5},()=>'<tr class="admin-contracts-skeleton" aria-hidden="true"><td colspan="4"><span></span></td></tr>').join('')+
   '</tbody></table></div>'+
  '<div class="admin-contracts-pagination">'+
   '<button type="button" class="app-link app-link-secondary" data-contracts-prev disabled data-contracts-copy="previous">Previous</button>'+
   '<span data-contracts-page aria-live="polite"></span>'+
   '<button type="button" class="app-link app-link-secondary" data-contracts-next disabled data-contracts-copy="next">Next</button></div>'+
  '<section class="admin-contracts-editor" data-contracts-editor hidden aria-labelledby="admin-contracts-edit-title">'+
   '<h3 id="admin-contracts-edit-title" data-contracts-copy="edit">Edit affiliation</h3>'+
   '<p data-contracts-selected></p>'+
   '<label for="admin-contract-club"><span data-contracts-copy="targetClub">Club</span>'+
    '<select id="admin-contract-club" class="language-trigger admin-contracts-select" data-contracts-select>'+
    '<option value="" data-contracts-copy="unassigned">Unassigned</option></select></label>'+
   '<div class="admin-contracts-actions">'+
    '<button type="button" class="app-link app-link-primary" data-contracts-save disabled data-contracts-copy="save">Save</button>'+
    '<button type="button" class="app-link app-link-secondary" data-contracts-unassign disabled data-contracts-copy="unassign">Unassign</button>'+
    '<button type="button" class="app-link app-link-secondary" data-contracts-cancel data-contracts-copy="cancel">Cancel</button>'+
    '<span data-contracts-working aria-live="polite"></span>'+
   '</div></section>'+
  '<p class="admin-contracts-message" data-contracts-message role="status" aria-live="polite"></p></section>';
}
