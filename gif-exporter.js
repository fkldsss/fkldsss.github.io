// 一鍵終極版：自動偵測 + 自動修復 + 自動匯出 ZIP
(function() {
    document.addEventListener('DOMContentLoaded', function() {

        const exportBtn = document.getElementById('btn-export-gif');
        if (!exportBtn) return;

        exportBtn.addEventListener('click', async function() {

            const manager = window.templateManager;
            if (!manager) {
                alert('❌ 播放器核心未載入');
                return;
            }

            const frames = manager.savedAggregateList.length > 0 ? manager.savedAggregateList : manager.templates;
            if (frames.length === 0) {
                alert('⚠️ 請先按 Gallery 建立影格！');
                return;
            }

            const container = document.getElementById('canvas-container');
            if (!container) return;

            if (typeof JSZip === 'undefined') {
                alert('❌ 壓縮工具 (JSZip) 尚未載入');
                return;
            }

            // ---- 階段 1：掃描並修復本地圖片 ----
            const pathsToFix = new Set();
            for (const frame of frames) {
                for (const sticker of (frame.stickers || [])) {
                    const src = sticker.src || '';
                    // 判斷是否為本地路徑
                    if (src.startsWith('file://') || src.includes('SAMPLES/') || 
                        (!src.startsWith('data:') && !src.startsWith('http') && src !== '')) {
                        pathsToFix.add(src);
                    }
                }
            }

            // 如果有需要修復的，執行修復程序
            if (pathsToFix.size > 0) {
                const pathList = Array.from(pathsToFix).map(p => '• ' + p.split('/').pop()).join('\n');
                const confirmMsg = '⚠️ 偵測到 ' + pathsToFix.size + ' 張本地圖片需要轉為 Base64。\n\n' +
                                   '請在跳出的視窗中，選取「SAMPLES 資料夾」內的「所有相關圖片檔案」\n' +
                                   '(建議按 Ctrl+A 全選)。\n\n' +
                                   '需要的檔案：\n' + pathList;
                if (!confirm(confirmMsg)) return;

                // 開啟檔案選取器 (允許多選)
                const dataMap = await new Promise((resolve) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = 'image/*';
                    input.style.display = 'none';
                    document.body.appendChild(input);

                    input.onchange = function(e) {
                        const files = e.target.files;
                        const map = {};
                        let loaded = 0;
                        if (files.length === 0) { resolve(null); return; }

                        for (let file of files) {
                            const reader = new FileReader();
                            reader.onload = function(ev) {
                                map[file.name] = ev.target.result;
                                loaded++;
                                if (loaded === files.length) {
                                    document.body.removeChild(input);
                                    resolve(map);
                                }
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    input.click();
                });

                if (!dataMap) {
                    alert('❌ 未選取任何檔案，修復取消。');
                    return;
                }

                // 執行替換
                let fixedCount = 0;
                for (const frame of frames) {
                    for (const sticker of (frame.stickers || [])) {
                        const src = sticker.src || '';
                        for (const [fileName, dataURL] of Object.entries(dataMap)) {
                            if (src.includes(fileName)) {
                                sticker.src = dataURL;
                                fixedCount++;
                                break;
                            }
                        }
                    }
                }

                // 同步更新 savedAggregateList
                if (manager.savedAggregateList.length > 0) {
                    manager.savedAggregateList = frames;
                }

                alert('✅ 已成功修復 ' + fixedCount + ' 個貼紙圖片！現在開始匯出...');
            }

            // ---- 階段 2：匯出 ZIP（此時所有圖片都已是 Base64） ----
            alert('📦 開始處理 ' + frames.length + ' 個影格...');

            const zip = new JSZip();
            const total = frames.length;

            for (let i = 0; i < total; i++) {
                manager.renderStateToCanvas(frames[i], false);
                await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 150)));

                const canvas = await html2canvas(container, {
                    useCORS: true,
                    allowTaint: false,
                    scale: 1,
                    backgroundColor: null,
                    logging: false
                });

                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                const fileName = '影格_' + String(i + 1).padStart(2, '0') + '.png';
                zip.file(fileName, blob);
                console.log('✅ ' + fileName + ' 已加入');
            }

            alert('🔄 打包壓縮中...');
            const zipBlob = await zip.generateAsync({ type: 'blob' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = '影格合集.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            alert('✅ 匯出完成！已下載「影格合集.zip」');
        });

    });
})();