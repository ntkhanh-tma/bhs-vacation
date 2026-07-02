/**
 * Vacation Planner — Google Apps Script Web App
 *
 * Write proxy for the vacation planner sheets (Sheets API v4 with API key is read-only).
 *
 * HOW TO DEPLOY:
 *   1. Open the Google Spreadsheet that contains your vacation data.
 *   2. Extensions → Apps Script → paste this file's contents, save.
 *   3. Deploy → New deployment → Web app.
 *        Execute as:  Me
 *        Who can access: Anyone
 *   4. Copy the deployment URL and store it as:
 *        • .env.local  →  VACATION_API_URL=https://script.google.com/macros/s/xxx/exec
 *        • GitHub secret  →  VACATION_API_URL
 *
 * Sheet: Vacation-Plan
 *   Row 1 (header): Month | Username | Date | Type
 *   Row 2+:         MM/YYYY | username | YYYY-MM-DD | Vacation|Compensation|Event|Deleted
 *
 * Sheet: Team-Info
 *   Row 1 (header): ID | DC | Team | Role | Name | Username | IP | Public IP | PC Name | MAC Address | BHS Email | Mobile | Birthday
 *   Row 2+:         data...
 */

var VACATION_SHEET  = 'Vacation-Plan';
var TEAM_INFO_SHEET = 'Team-Info';
var VALID_TYPES     = ['Vacation', 'Compensation', 'Event'];

// ── GET — diagnostic read of vacation rows ───────────────────────────────────
function doGet() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VACATION_SHEET);
    if (!sheet) return respond({ success: false, error: 'Sheet "' + VACATION_SHEET + '" not found.' });

    var rows = sheet.getDataRange().getValues();
    var data = rows.slice(1)
      .filter(function(r) { return r[1] && r[2]; })
      .map(function(r) {
        return {
          month:    String(r[0] || '').trim(),
          username: String(r[1] || '').trim().toLowerCase(),
          date:     String(r[2] || '').trim(),
          type:     String(r[3] || 'Vacation').trim(),
        };
      });

    return respond({ success: true, data: data });
  } catch (err) {
    return respond({ success: false, error: String(err.message || err) });
  }
}

// ── POST — route by action ────────────────────────────────────────────────────
//
// All payloads are JSON stringified and sent as Content-Type: text/plain
// to avoid a CORS preflight (Apps Script 302-redirects before adding CORS headers).
//
function doPost(e) {
  var lock = LockService.getScriptLock();
  var lockAcquired = lock.tryLock(10000);
  if (!lockAcquired) {
    return respond({ success: false, error: 'Server busy — please try again in a moment.' });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respond({ success: false, error: 'Missing request body.' });
    }

    var payload = JSON.parse(e.postData.contents);
    var action  = String((payload && payload.action) || 'vacation').trim().toLowerCase();

    if (action === 'updateprofile') {
      return handleUpdateProfile(payload);
    }

    return handleVacation(payload);

  } catch (err) {
    return respond({ success: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

// ── Vacation handler ──────────────────────────────────────────────────────────
function handleVacation(payload) {
  var username    = String(payload.username    || '').trim().toLowerCase();
  var month       = String(payload.month       || '').trim();
  var rawType     = String(payload.type        || '').trim();
  var type        = VALID_TYPES.indexOf(rawType) >= 0 ? rawType : 'Vacation';
  var addDates    = Array.isArray(payload.addDates)    ? payload.addDates    : [];
  var removeDates = Array.isArray(payload.removeDates) ? payload.removeDates : [];

  if (!username) return respond({ success: false, error: '"username" is required.' });
  if (!month)    return respond({ success: false, error: '"month" is required.' });
  if (addDates.length === 0 && removeDates.length === 0) {
    return respond({ success: false, error: 'Nothing to add or remove.' });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VACATION_SHEET);
  if (!sheet) return respond({ success: false, error: 'Sheet "' + VACATION_SHEET + '" not found.' });

  // Soft-delete: set Type = "Deleted" rather than removing rows
  if (removeDates.length > 0) {
    var allRows = sheet.getDataRange().getValues();
    for (var i = 1; i < allRows.length; i++) {
      var rowUser = String(allRows[i][1] || '').trim().toLowerCase();
      var rowDate = String(allRows[i][2] || '').trim();
      if (rowUser === username && removeDates.indexOf(rowDate) >= 0) {
        sheet.getRange(i + 1, 4).setValue('Deleted');
      }
    }
  }

  // Append new rows (dedup within this request and against existing data)
  if (addDates.length > 0) {
    var currentRows = sheet.getDataRange().getValues().slice(1);
    var existingKeys = {};
    for (var k = 0; k < currentRows.length; k++) {
      var u = String(currentRows[k][1] || '').trim().toLowerCase();
      var d = String(currentRows[k][2] || '').trim();
      var t = String(currentRows[k][3] || '').trim();
      if (u && d && t !== 'Deleted') existingKeys[u + '|' + d] = true;
    }

    for (var j = 0; j < addDates.length; j++) {
      var key = username + '|' + String(addDates[j]).trim();
      if (!existingKeys[key]) {
        sheet.appendRow([month, username, String(addDates[j]).trim(), type]);
        existingKeys[key] = true;
      }
    }
  }

  return respond({ success: true });
}

// ── Profile update handler ────────────────────────────────────────────────────
//
// Finds the row where A=id AND F=authUsername, then updates allowed columns.
// Team-Info columns: A=1:ID | B=2:DC | C=3:Team | D=4:Role | E=5:Name |
//                    F=6:Username | G=7:IP | H=8:Public IP | I=9:PC Name |
//                    J=10:MAC Address | K=11:BHS Email | L=12:Mobile | M=13:Birthday
//
function handleUpdateProfile(payload) {
  var id           = String(payload.id           || '').trim();
  var authUsername = String(payload.authUsername  || '').trim().toLowerCase();
  var updates      = payload.updates || {};

  if (!id || !authUsername) {
    return respond({ success: false, error: '"id" and "authUsername" are required.' });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TEAM_INFO_SHEET);
  if (!sheet) return respond({ success: false, error: 'Sheet "' + TEAM_INFO_SHEET + '" not found.' });

  var rows      = sheet.getDataRange().getValues();
  var targetRow = -1;
  for (var i = 1; i < rows.length; i++) {
    var rowId   = String(rows[i][0] || '').trim();
    var rowUser = String(rows[i][5] || '').trim().toLowerCase();
    if (rowId === id && rowUser === authUsername) {
      targetRow = i + 1; // 1-indexed for sheet API
      break;
    }
  }

  if (targetRow === -1) {
    return respond({ success: false, error: 'Profile not found or unauthorized.' });
  }

  // Update only the columns the client is allowed to change
  if (updates.dc         !== undefined) sheet.getRange(targetRow, 2).setValue(String(updates.dc));
  if (updates.department !== undefined) sheet.getRange(targetRow, 3).setValue(String(updates.department));
  if (updates.role       !== undefined) sheet.getRange(targetRow, 4).setValue(String(updates.role));
  if (updates.username   !== undefined) sheet.getRange(targetRow, 6).setValue(String(updates.username).trim().toLowerCase());
  if (updates.ip         !== undefined) sheet.getRange(targetRow, 7).setValue(String(updates.ip));
  if (updates.publicIp   !== undefined) sheet.getRange(targetRow, 8).setValue(String(updates.publicIp));
  if (updates.pcName     !== undefined) sheet.getRange(targetRow, 9).setValue(String(updates.pcName));
  if (updates.macAddress !== undefined) sheet.getRange(targetRow, 10).setValue(String(updates.macAddress));
  if (updates.email      !== undefined) sheet.getRange(targetRow, 11).setValue(String(updates.email));
  if (updates.mobile     !== undefined) sheet.getRange(targetRow, 12).setValue(String(updates.mobile));
  if (updates.birthday   !== undefined) sheet.getRange(targetRow, 13).setValue(String(updates.birthday));

  return respond({ success: true });
}

// ── Helper ────────────────────────────────────────────────────────────────────
function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
