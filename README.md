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

尚未用真實商家帳號、授權終端與實體卡完成後端付款驗收。忘記密碼、註銷等未串接功能仍明確提示；本次未新增管理員審核頁。