function showNotification(message) {
    const notification = _id('notification');
    notification.textContent = message;
    notification.classList.add('show');

    setTimeout( () => {
        notification.classList.remove('show');
    }
    , 3000);
}
_on(document,'DOMContentLoaded', function() {
    const fileInput = _id('file-input');
    const fileListContainer = _id('file-list-container');
    const contentDisplay = _id('content-display');
    const searchInput = _id('search-input');
    const searchBtn = _id('search-btn');
    const resultContainer = _id('result-container');
    const prevBtn = _id('prev-btn');
    const nextBtn = _id('next-btn');

    let files = [];
    let currentFileIndex = -1;
    let searchResults = {};
    let currentMatch = {
        fileIndex: -1,
        matchIndex: -1
    };

    // 事件监听
    _on(fileInput,'change', handleFileSelect);
    _on(searchBtn,'click', performSearch);
    _on(prevBtn,'click', () => navigateMatch(-1));
    _on(nextBtn,'click', () => navigateMatch(1));

    // 确保面板在加载时正确显示滚动条
    function ensureScrollbars() {
        [fileListContainer, contentDisplay, resultContainer].forEach(panel => {
            panel.style.overflow = 'auto';
        }
        );
    }

    // 文件选择处理
    function handleFileSelect(e) {
        const newFiles = Array.from(e.target.files);
        files = [...files, ...newFiles];
        renderFileList();
        ensureScrollbars();
        if (files.length > 0 && currentFileIndex === -1) {
            displayFileContent(0);
        }
    }

    // 渲染文件列表
    function renderFileList() {
        fileListContainer.innerHTML = '';
        files.forEach( (file, index) => {
            const fileItem = _c('div');
            fileItem.className = `file-item ${index === currentFileIndex ? 'active' : ''}`;
            fileItem.textContent = file.name;
            _on(fileItem,'click', async () => await displayFileContent(index));
            fileListContainer.appendChild(fileItem);
        }
        );
    }

    // 显示work文件
    async function displayWordFileContent(index) {
        const file = files[index];
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({
            arrayBuffer
        });
        return result.value;
    }

    function afterDisplayFileContent() {
        updateActiveFileStyle();
        ensureScrollbars();
        if (searchInput.value.trim()) {
            highlightMatchesInCurrentFile();
        }
    }

    // 显示文件内容
    async function displayFileContent(index) {
        currentFileIndex = index;
        const file = files[index];

        if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
            contentDisplay.innerHTML = await displayWordFileContent(index);
            afterDisplayFileContent();
            return;
        }

        const reader = new FileReader();

        reader.onload = function(e) {
            contentDisplay.innerHTML = e.target.result;
            afterDisplayFileContent()
        }
        ;

        reader.readAsText(file);
    }

    // 更新活动文件样式
    function updateActiveFileStyle() {
        document.querySelectorAll('.file-item').forEach( (item, index) => {
            item.classList.toggle('active', index === currentFileIndex);
        }
        );
    }

    //执行文件内容的匹配及渲染搜索结果
    function matchSeatchAndDisplay(searchResults, fileIndex, searchTerm, file, content) {
        const regex = new RegExp(escapeRegExp(searchTerm),'gi');
        let match;
        const matches = [];

        while ((match = regex.exec(content)) !== null) {
            matches.push({
                index: match.index,
                length: match[0].length,
                context: getMatchContext(content, match.index, match[0].length)
            });
        }

        if (matches.length > 0) {
            searchResults[fileIndex] = matches;
            renderSearchResult(file, fileIndex, matches);
            return true;
        }
        return false;
    }

    function finishSearchFiles(hasResults) {
        showNotification(hasResults ? `搜索完成，共找到${Object.keys(searchResults).length}个文件包含结果` : '搜索完成，未找到匹配内容');
    }
    // 执行搜索
    function performSearch() {
        const searchTerm = searchInput.value.trim();
        if (!searchTerm)
            return;

        searchResults = {};
        resultContainer.innerHTML = '';
        let filesProcessed = 0;
        let hasResults = false;

        files.forEach(async (file, fileIndex) => {
            //所有文件处理完再提示
            filesProcessed++;

            if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
                const wordContent = await displayWordFileContent(fileIndex);
                hasResults = matchSeatchAndDisplay(searchResults, fileIndex, searchTerm, file, wordContent);
                if (filesProcessed === files.length) {
                    finishSearchFiles(hasResults);
                }
                return;
            }

            const reader = new FileReader();

            reader.onload = function(e) {
                const content = e.target.result;
                hasResults = matchSeatchAndDisplay(searchResults, fileIndex, searchTerm, file, content);
                if (filesProcessed === files.length) {
                    finishSearchFiles(hasResults);
                }
            }
            ;

            reader.readAsText(file);
        }
        );

        // 如果没有文件需要处理，立即提示
        if (files.length === 0) {
            showNotification('没有可搜索的文件');
        }
    }

    // 渲染搜索结果
    function renderSearchResult(file, fileIndex, matches) {
        const resultGroup = _c('div');
        resultGroup.className = 'result-group';

        const resultHeader = _c('div');
        resultHeader.className = 'result-header';
        resultHeader.innerHTML = `
            <span>${file.name} (${matches.length}处匹配)</span>
            <span>▶</span>
        `;

        const resultContent = _c('div');
        resultContent.className = 'result-content';

        matches.forEach( (match, matchIndex) => {
            const matchItem = _c('div');
            matchItem.className = 'match-item';
            matchItem.innerHTML = `...${highlightMatch(match.context, searchInput.value)}...`;
            _on(matchItem,'click', () => {
                displayFileContent(fileIndex);
                scrollToMatch(fileIndex, matchIndex);
            }
            );
            resultContent.appendChild(matchItem);
        }
        );

        _on(resultHeader,'click', () => {
            const isHidden = resultContent.style.display !== 'block';
            resultContent.style.display = isHidden ? 'block' : 'none';
            resultHeader.querySelector('span:last-child').textContent = isHidden ? '▼' : '▶';
            ensureScrollbars();
        }
        );

        resultGroup.appendChild(resultHeader);
        resultGroup.appendChild(resultContent);
        resultContainer.appendChild(resultGroup);

        // 默认展开第一个结果组
        if (Object.keys(searchResults).length === 1) {
            resultHeader.click();
        }
    }

    // 高亮当前文件中的匹配项
    function highlightMatchesInCurrentFile() {
        if (currentFileIndex === -1 || !searchResults[currentFileIndex])
            return;

        const content = contentDisplay.innerHTML;
        const matches = searchResults[currentFileIndex];
        let highlightedContent = '';
        let lastIndex = 0;

        matches.forEach(match => {
            highlightedContent += content.substring(lastIndex, match.index);
            highlightedContent += `<span class="highlight">${content.substring(match.index, match.index + match.length)}</span>`;
            lastIndex = match.index + match.length;
        }
        );

        highlightedContent += content.substring(lastIndex);
        contentDisplay.innerHTML = highlightedContent;
    }

    // 导航匹配项
    function navigateMatch(direction) {
        if (currentFileIndex === -1 || !searchResults[currentFileIndex])
            return;

        const matches = searchResults[currentFileIndex];
        let newIndex = currentMatch.matchIndex + direction;

        if (newIndex < 0) {
            newIndex = matches.length - 1;
        } else if (newIndex >= matches.length) {
            newIndex = 0;
        }

        scrollToMatch(currentFileIndex, newIndex);
    }

    // 滚动到匹配项
    function scrollToMatch(fileIndex, matchIndex) {
        if (fileIndex !== currentFileIndex) {
            displayFileContent(fileIndex);
        }

        currentMatch = {
            fileIndex,
            matchIndex
        };
        const highlighted = _findAll(contentDisplay,'.highlight');

        if (highlighted.length > matchIndex) {
            highlighted[matchIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }

    // 辅助函数
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function getMatchContext(text, index, length) {
        const start = Math.max(0, index - 20);
        const end = Math.min(text.length, index + length + 20);
        return text.substring(start, end);
    }

    function highlightMatch(text, term) {
        const regex = new RegExp(escapeRegExp(term),'gi');
        return text.replace(regex, match => `<span class="highlight">${match}</span>`);
    }

    // 初始化时确保滚动条可见
    ensureScrollbars();
});
