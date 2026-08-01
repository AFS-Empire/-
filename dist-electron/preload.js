"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 预加载脚本 —— 安全桥接层
 *
 * 渲染层（React）运行在沙箱里，没有 Node 权限；
 * 只通过 contextBridge 暴露一组极小、明确的 IPC 通道给 UI 调用。
 * 未来如果要加能力（托盘、通知、协议）都在这里注册。
 */
const electron_1 = require("electron");
/** 暴露给 UI 的 API（window.archiveApp） */
const api = {
    /** 是否已处于 Electron 环境（否则就是纯浏览器访问） */
    isDesktop: true,
    /** 把渲染层生成的完整 JSON 备份保存到用户选择的磁盘路径 */
    saveBackup(args) {
        return electron_1.ipcRenderer.invoke('backup:save', args);
    },
    /** 从用户选择的磁盘路径读取备份 JSON（返回到渲染层再解析） */
    loadBackup() {
        return electron_1.ipcRenderer.invoke('backup:load');
    },
    /** 推送一份自动快照（节流，主进程按需写时间戳） */
    pushAutoSnapshot(args) {
        return electron_1.ipcRenderer.invoke('backup:auto-snapshot', args);
    },
    /** 退出前推送最终快照（强制带时间戳） */
    pushFinalSnapshot(args) {
        return electron_1.ipcRenderer.invoke('backup:final-snapshot', args);
    },
    /** 列出所有自动备份 */
    listAutoBackups() {
        return electron_1.ipcRenderer.invoke('backup:list-auto');
    },
    /** 从指定自动备份恢复 */
    restoreAutoBackup(args) {
        return electron_1.ipcRenderer.invoke('backup:restore-auto', args);
    },
    /** 删除某个自动备份（latest 不可删） */
    deleteAutoBackup(args) {
        return electron_1.ipcRenderer.invoke('backup:delete-auto', args);
    },
    /** 取应用基本信息（版本 / 数据目录路径，用于设置页展示） */
    getAppInfo() {
        return electron_1.ipcRenderer.invoke('app:info');
    },
    /** 多人实时同步状态（端口预留，暂未启用） */
    getSyncStatus() {
        return electron_1.ipcRenderer.invoke('sync:status');
    },
    /** 监听主进程"准备退出"事件，渲染层应立即推送最终快照 */
    onPrepareQuit(cb) {
        electron_1.ipcRenderer.on('app:prepare-quit', () => cb());
    },
};
// 只在有 contextBridge 时暴露（正常 Electron 环境必然存在）
if (typeof electron_1.contextBridge !== 'undefined') {
    electron_1.contextBridge.exposeInMainWorld('archiveApp', api);
}
