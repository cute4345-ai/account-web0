# 電子錢包網頁：註冊、綁卡與商家收款

保留原本 index.html、style.css、account.css 與 assets 設計，更新 app.js 的後端串接。

API_BASE：https://ips-totals-custom-feature.trycloudflare.com/api/v1

## 部署

將上傳包解壓縮後的檔案放在 cute4345-ai/account-web0 儲存庫根目錄，覆蓋同名檔案並保留 assets 結構。不要只上傳 ZIP。等待 Actions 最新部署顯示綠勾，再開啟 https://cute4345-ai.github.io/account-web0/ 並按 Ctrl+F5。

GitHub 連接器沒有寫入權限；本機修改完成不代表線上網站已更新。

## 操作

1. 註冊與登入：沒有預設帳號，使用後端資料登入。
2. 綁卡：卡片管理建立任務並複製 requestId。桌面讀卡程式「註冊綁卡回報」設定相同 API 網址及 HARDWARE_API_TOKEN，插卡回報。網頁 READY 後確認綁卡。
3. 首頁與卡片管理：GET /me/wallet 載入卡片及餘額，重新登入也會載入。只有 card:null 顯示未綁卡，查詢失敗顯示錯誤。
4. 商家申請：送商家名稱、電話到 POST /me/merchant，依後端顯示待審核、通過、拒絕或停權。拒絕後可重新申請；管理員依後端既有程序審核。
5. 商家收款：通過審核後輸入金額及後端核准的 terminalId 建立訂單。在讀卡程式付款模式設定同一後端、終端及 READER_API_TOKEN 完成實體卡付款。網頁查詢訂單，僅後端 SUCCEEDED 顯示付款完成並更新餘額。
6. 紀錄：個人 GET /me/transactions、商家 GET /merchant/transactions，支援更新與載入更多。

付款使用 Idempotency-Key；建立結果不明時沿用原鍵與內容重試。付款草稿存於 sessionStorage，不含權杖。登入權杖只在分頁記憶體，重新整理後需登入。

HARDWARE_API_TOKEN、READER_API_TOKEN 與使用者登入權杖不能互用；硬體及終端權杖不要上傳 GitHub。商家通過審核後，後端仍需設定 merchantCode 與授權終端才能付款。

## 驗證範圍

2026-11-17：JS 語法與 28 項模擬 HTTP/DOM 測試通過，涵蓋綁卡同步、商家狀態、金額、訂單重試及紀錄格式。新 API /health 回傳 200，CORS 允許 https://cute4345-ai.github.io，以及 Authorization、Content-Type、Idempotency-Key。

尚未用真實商家帳號、授權終端與實體卡完成後端付款驗收。管理員審核與補卡未新增網頁；本次不建立管理員。

## 忘記密碼（2026-11-17）

登入頁點忘記密碼，輸入註冊帳號與身分證，再回答安全問題，設定12–128字元新密碼。三步依序使用 POST /auth/password/challenges、/auth/password/verify、/auth/password/reset，不帶登入或硬體權杖。挑戰有效5分鐘、重設憑證有效2分鐘；憑證僅存記憶體。成功後清除本頁登入及恢復憑證，返回登入頁。後端依規格撤銷既有登入，但保留餘額與綁卡。最後一步逾時先用新密碼登入確認，避免直接重送。

忘記密碼20項模擬測試通過，未對真實帳號執行密碼重設。這次只需重新上傳 app.js 與 README.md。


## 使用者功能補齊（2026-11-17）

新增登入後變更網站密碼（首頁／卡片管理入口）、正式登出（204無JSON）、遺失永久註銷、台北日曆起迄日期查詢。日期由後端篩選全部資料，下一頁保留原條件，畫面時間固定Asia/Taipei。註銷會保留原餘額與歷史；replacementRequired=true 顯示管理員補卡，不允許普通BIND流程。註銷無法恢復，請放在實體測試最後，不要為驗收刪掉卡片歷史。

網頁共70項模擬測試通過（商家／綁卡28、忘記密碼20、使用者功能22）。尚未完成真實帳號改密碼、註銷、後端儲值及實體卡付款驗收。

讀卡程式新增「後端授權儲值」，用TOPUP_API_TOKEN建立TOPUP讀卡任務，以HARDWARE_API_TOKEN回報；查看餘額會消耗憑證，儲值會重新讀卡。按「確認模擬收款並儲值」才會建立入帳請求。結果不明時保存DPAPI加密的完整原JSON，按「確認上次儲值結果」沿用同一UUID、金額與憑證，不重建另一筆。權杖不可上傳GitHub。

管理員補卡尚無網頁操作介面；此版硬體回報可接收管理員建立的REPLACE任務，但須由原管理員透過後端流程確認補卡。目前無管理員、商家與付款終端登記，補卡亦需未登記新卡；這些準備未就緒時不可宣稱整體驗收完成。
