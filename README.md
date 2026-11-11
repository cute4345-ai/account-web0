# 原版畫面＋註冊綁卡 API

以使用者提供的Desktop/網頁/web為畫面基準，保留index.html、style.css、account.css及assets；只將app.js的註冊、登入、綁卡流程改成實際後端呼叫。新增確認密碼欄位配合後端confirmPassword要求。

API基底為 https://linux-shots-volunteer-requiring.trycloudflare.com/api/v1 。網址更換時修改app.js的API_BASE。請在GitHub Pages或HTTP服務開啟，避免file://的Origin導致CORS失敗。

## 部署

將index.html、app.js、style.css、account.css與完整assets資料夾上傳到cute4345-ai/account-web網站根目錄，覆蓋對應檔案；不要上傳ZIP作為網站。部署後直接使用原網址 https://cute4345-ai.github.io/account-web/ ，不必改用registration-live.html。

GitHub連接器先前因403無法寫入，因此此交付是本機更新與上傳包，不代表網站已部署。

## 操作

1. 註冊新帳號，密碼12–128字元、填入後端接受的測試身分資料與安全問題，不存在預設登入帳號。
2. 註冊API成功後回登入，使用新帳號登入。
3. 卡片管理→綁定卡片→建立綁卡任務，複製requestId。
4. 開啟桌面讀卡程式「註冊綁卡回報」，填HARDWARE_API_TOKEN（不同於付款權杖），貼上requestId，插實體卡並回報。
5. 網頁等待後端READY後顯示實際卡號，使用者確認綁卡，後端回成功才顯示綁定完成。

卡號與公鑰由讀卡端回報受控後端；網頁bind只送一次性cardReadToken，帳號由登入權杖判斷。任務120秒有效。硬體權杖不放網頁。網頁登入權杖只在分頁記憶體，重整後需重新登入；未取得既有卡片查詢API，因此重新登入不假裝已知道既有綁卡狀態。

## 邊界與驗證

原霧藍版型、側邊導覽、密碼顯示切換及綁卡對話框沿用。移除可操作的預設示範帳號入口與模擬插卡。未串接的忘記密碼、商家、付款、交易查詢及註銷畫面顯示尚未串接，不使用記憶體假資料冒充後端結果。

後端註冊/綁卡請求逾時不能視為未寫入；確認綁卡結果不明時不自動重送，先核對後端。此版不新增後端沒有提供的查詢端點或其他發卡規則。

已檢查JS語法，使用模擬DOM/HTTP測試原版初始化、無預設帳號、原註冊panel、註冊精確欄位、data.accessToken登入、側邊導覽、實體綁卡任務畫面、未串接功能拒絕模擬。index.html及兩個CSS與使用者原始檔雜湊一致。內建瀏覽器未能連到本機預覽服務，因此尚未完成瀏覽器視覺和實際後端註冊綁卡驗收。
