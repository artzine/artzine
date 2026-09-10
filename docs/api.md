# API reference

Generated from the canonical contract. Version 0.1.0; digest `sha256:eea66c5812140736e839b2384202cefda1a5b6e4b5f3d93764a8ae87afe3fc78`.

| Operation | HTTP | Scope | MCP |
| --- | --- | --- | --- |
| getCapabilities | GET /v1/capabilities | Public |  |
| searchPublic | GET /v1/search | Public | artzine_search |
| getWork | GET /v1/works/{id} | Public | artzine_get_work |
| deleteWork | DELETE /v1/works/{id} | work:delete | artzine_delete_work |
| getOwnedWork | GET /v1/me/works/{id} | work:read | artzine_get_owned_work |
| listOwnedWorks | GET /v1/me/works | work:read | artzine_list_owned_works |
| getProfile | GET /v1/profiles/{handle} | Public | artzine_get_profile |
| getAccount | GET /v1/me | account:read |  |
| deleteAccount | DELETE /v1/me | account:delete |  |
| createProfile | POST /v1/me/profiles | profile:write |  |
| listOwnedProfiles | GET /v1/me/profiles | profile:read |  |
| updateProfile | PATCH /v1/me/profiles/{id} | profile:write |  |
| deleteProfile | DELETE /v1/me/profiles/{id} | profile:delete |  |
| getOwnedProfile | GET /v1/me/profiles/{id} | profile:read |  |
| prepareWork | POST /v1/preparations | work:prepare | artzine_prepare_work |
| getPreparation | GET /v1/preparations/{id} | work:read | artzine_get_preparation |
| revisePreparation | PATCH /v1/preparations/{id} | work:prepare | artzine_revise_preparation |
| cancelPreparation | DELETE /v1/preparations/{id} | work:prepare |  |
| reserveUploads | POST /v1/uploads | asset:write |  |
| issueUploadGrant | POST /v1/uploads/{id}/grant | asset:write |  |
| completeUpload | POST /v1/uploads/{id}/complete | asset:write |  |
| publishWork | POST /v1/works/publish | work:publish | artzine_publish_work |
| withdrawWork | POST /v1/works/{id}/withdraw | work:withdraw | artzine_withdraw_work |
| getDeletion | GET /v1/deletions/{id} | account:read |  |
| exportAccount | POST /v1/me/exports | account:export | artzine_export_account |
| reportWork | POST /v1/reports | Public |  |
| saveWork | PUT /v1/saves/{work_id} | collection:write | artzine_save_work |
| unsaveWork | DELETE /v1/saves/{work_id} | collection:write | artzine_unsave_work |
| listSaves | GET /v1/saves | collection:read | artzine_list_saves |
| mergeSaves | POST /v1/saves/merge | collection:write |  |
| getCollection | GET /v1/collections/{id} | Public | artzine_get_collection |
| updateCollection | PATCH /v1/collections/{id} | collection:write | artzine_update_collection |
| deleteCollection | DELETE /v1/collections/{id} | collection:delete | artzine_delete_collection |
| getOwnedCollection | GET /v1/me/collections/{id} | collection:read | artzine_get_owned_collection |
| listOwnedCollections | GET /v1/me/collections | collection:read | artzine_list_owned_collections |
| createCollection | POST /v1/collections | collection:write | artzine_create_collection |
| moveCollectionEntries | POST /v1/collections/move | collection:write | artzine_move_collection_entries |
| duplicateCollection | POST /v1/collections/{id}/duplicate | collection:write | artzine_duplicate_collection |
| publishCollection | POST /v1/collections/{id}/publish | collection:publish | artzine_publish_collection |
| withdrawCollection | POST /v1/collections/{id}/withdraw | collection:withdraw | artzine_withdraw_collection |
| submitClaim | POST /v1/profiles/{id}/claims | profile:claim |  |
| getClaim | GET /v1/me/claims/{id} | profile:claim |  |
| cancelClaim | DELETE /v1/me/claims/{id} | profile:claim |  |
| createImportGrant | POST /v1/import-grants | profile:write |  |
| revokeImportGrant | DELETE /v1/import-grants/{id} | profile:write |  |
| getImportGrant | GET /v1/import-grants/{id} | profile:read |  |
| getMediaGrant | GET /v1/works/{id}/media/{asset_id} | Public |  |
| getPreparationMediaGrant | GET /v1/preparations/{id}/assets/{asset_id}/grant | work:read | artzine_preview_preparation_media |
| getUploadSlot | GET /v1/uploads/{id} | asset:write | artzine_get_upload |
| getAccountExport | GET /v1/me/exports/{id} | account:export | artzine_get_account_export |
| getAccountExportPage | GET /v1/me/exports/{id}/pages/{page} | account:export | artzine_get_account_export_page |
| getAccountExportFile | GET /v1/me/exports/{id}/files/{asset_id} | account:export | artzine_get_account_export_file |
| listWorkCollections | GET /v1/works/{id}/collections | Public | artzine_list_work_collections |
| getProfileMediaGrant | GET /v1/profiles/{id}/media/{asset_id} | Public | artzine_get_profile_media_grant |
| getSubject | GET /v1/subjects/{id} | Public | artzine_get_subject |
| getFeatured | GET /v1/features/{surface} | Public | artzine_get_featured |
