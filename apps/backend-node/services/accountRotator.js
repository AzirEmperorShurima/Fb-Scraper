import { FBAccount } from "../models/index.js";

/**
 * Runs a scraping task with account rotation.
 * 
 * @param {Array} fbAccountIds - Array of specific account IDs to try.
 * @param {Array} customCookies - Optional custom cookies to use.
 * @param {Function} appendLog - Function to log messages.
 * @param {Function} task - The scraping task `async (account, cookies) => { return { posts, newCookies } }`
 */
export const runWithAccountRotation = async (fbAccountIds, customCookies, appendLog, task) => {
  let accountsToTry = [];

  if (fbAccountIds && Array.isArray(fbAccountIds) && fbAccountIds.length > 0) {
    for (const id of fbAccountIds) {
      const acc = await FBAccount.findById(id);
      if (acc) accountsToTry.push(acc);
    }
  }

  if (accountsToTry.length === 0 && !customCookies) {
    // Fallback
    const acc = await FBAccount.findOne({ status: "valid" });
    if (acc) accountsToTry.push(acc);
  }

  if (accountsToTry.length === 0 && !customCookies) {
    throw new Error("No Facebook accounts or custom cookies available to run the task.");
  }

  let success = false;
  let result = null;
  let lastError = null;
  let usedAccountIndex = 0;

  if (customCookies && accountsToTry.length === 0) {
    let cookies = [];
    try {
      cookies = typeof customCookies === "string" ? JSON.parse(customCookies) : customCookies;
    } catch (e) {}

    await appendLog(`🔄 Bắt đầu cào bằng Custom Cookies...`);
    
    result = await task(null, cookies);
    success = true;
  } else {
    for (let i = 0; i < accountsToTry.length; i++) {
      const account = accountsToTry[i];
      let cookies = [];
      try {
        cookies = typeof account.cookies_json === "string" ? JSON.parse(account.cookies_json) : account.cookies_json;
      } catch (e) {}

      await appendLog(`🔄 Đang thử cào với tài khoản: ${account.email} (${i+1}/${accountsToTry.length})`);

      try {
        const { posts, cookies: newCookies } = await task(account, cookies);

        if (newCookies && newCookies.length > 0) {
          account.cookies_json = newCookies;
        }
        account.status = "valid";
        account.last_used = new Date();
        account.success_count = (account.success_count || 0) + 1;
        await account.save();
        
        result = { posts };
        success = true;
        usedAccountIndex = i;
        break; // Success!
      } catch (err) {
        lastError = err;
        await appendLog(`❌ Lỗi với tài khoản ${account.email}: ${err.message}`);
        account.fail_count = (account.fail_count || 0) + 1;
        await account.save();

        if (i < accountsToTry.length - 1) {
           await appendLog(`➡️ Chuyển sang tài khoản dự phòng tiếp theo...`);
        }
      }
    }
  }

  if (!success) {
    throw lastError || new Error("Quá trình cào thất bại trên tất cả các tài khoản dự phòng.");
  }

  return { result, usedAccountIndex, accountsToTry };
};
