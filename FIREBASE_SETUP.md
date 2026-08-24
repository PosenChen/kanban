# Firebase Firestore 數據持久化設置指南

## 🎯 功能概述
本看板已集成 Firebase Firestore，可以實現：
- ✅ 跨裝置數據同步
- ✅ 即時數據更新
- ✅ 自動數據保存
- ✅ 數據備份與恢復

## 📋 設置步驟

### 步驟 1: 建立 Firestore 數據庫
1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 選擇您的項目 `kanban-board-8c1f0`
3. 點擊左側選單的 **"Firestore 資料庫"**
4. 點擊 **"建立數據庫"**
5. 選擇 **"起用模式"** (測試模式)
6. 選擇伺服器位置（推薦 `asia-east1` 適合台灣使用者）
7. 點擊 **"下一步"**

### 步驟 2: 設置安全規則
1. 在 Firestore 選單中，點擊 **"規則"** 標籤
2. 複製並貼上以下規則：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 專案文檔規則
    match /projects/{projectId} {
      // 允許所有人讀取專案
      allow read: if true;
      
      // 允許所有人寫入專案
      allow write: if true;
    }
  }
}
```

3. 點擊 **"發布"**

### 步驟 3: 啟用 Firebase 同步
1. 在您的看板中，前往 **"設置"** 頁面
2. 找到 **"Firebase Firestore 同步"** 部分
3. 點擊 **"啟用同步"** 按鈕
4. 數據將自動同步到 Firebase

## 🔧 技術細節

### 文件結構
- `src/services/firebaseService.ts` - Firebase 服務模組
- `src/hooks/useProjects.ts` - 數據同步 Hook
- `src/data/localStorageStore.ts` - 本地存儲管理
- `src/pages/SettingsPage.tsx` - 設置頁面

### 數據結構
Firestore 中的專案數據格式：
```javascript
{
  id: string,           // 專案 ID
  name: string,         // 專案名稱
  description: string,  // 專案描述
  status: string,       // 狀態
  priority: string,     // 優先級
  start_date: string,   // 開始日期
  end_date: string,     // 結束日期
  tags: string[],       // 標籤
  progress: number,     // 進度 (0-100)
  created_at: string,   // 創建時間
  updated_at: string,   // 更新時間
  parent_id: string | null, // 父專案 ID
  actual_start_date: string | null, // 實際開始日期
  actual_end_date: string | null    // 實際結束日期
}
```

## 🚀 使用說明

### 啟用 Firebase 同步
1. 在設置頁面點擊 **"啟用同步"**
2. 數據將自動同步到 Firebase
3. 在任何裝置上打開看板，數據都會同步

### 手動同步
1. 在設置頁面點擊 **"立即同步"**
2. 系統會將本地數據同步到 Firebase
3. 同步狀態會顯示在頁面上

## ⚠️ 注意事項

### 測試模式 vs 安全模式
- **測試模式**：所有人可以讀寫（推薦初始使用）
- **安全模式**：需要配置 Firebase 身份驗證

### 數據備份
- 本地數據仍保存在 LocalStorage 中
- 您可以使用匯出/匯入功能作為備份
- 建議定期導出 JSON 文件

### 性能優化
- Firebase 會自動處理數據同步
- 大規模數據時建議使用分頁查詢
- 可以添加索引來優化查詢性能

## 🛠 故障排除

### 同步失敗
1. 檢查 Firebase 項目是否正確配置
2. 確認 Firestore 數據庫是否已建立
3. 查看瀏覽器控制台的錯誤信息

### 數據不一致
1. 檢查網路連接
2. 確認 Firebase 規則是否正確
3. 嘗試手動同步

## 📞 支援

如果遇到問題，請：
1. 檢查 Firebase Console 中的日志
2. 查看瀏覽器控制台的錯誤信息
3. 確認網絡連接正常

## 🔒 安全建議

### 生產環境建議
1. 啟用 Firebase 身份驗證
2. 使用更嚴格的安全規則
3. 定期備份數據
4. 監控 Firebase 用量

### 推薦安全規則
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 🎉 完成！

現在您的看板已經具備完整的數據持久化功能，可以在不同裝置間同步數據了！
