function showNotification(message) {
    const notification = _id('notification');
    notification.textContent = message;
    notification.classList.add('show');

    setTimeout( () => {
        notification.classList.remove('show');
    }
    , 3000);
}
_on(document, 'DOMContentLoaded', function() {
    const fileInput = _id('file-input');
    const fileListContainer = _id('file-list-container');
    const contentDisplay = _id('content-display');
    const searchInput = _id('search-input');
    const searchBtn = _id('search-btn');
    const resultContainer = _id('result-container');
    const prevBtn = _id('prev-btn');
    const nextBtn = _id('next-btn');

    let files = [];
    let fileContents = {};
    let currentFileName = null;
    let searchResults = {};
    let currentMatch = {
        fileIndex: -1,
        matchIndex: -1
    };

    // 事件监听
    _on(fileInput, 'change', handleFileSelect);
    _on(searchBtn, 'click', performSearch);
    _on(prevBtn, 'click', () => navigateMatch(-1));
    _on(nextBtn, 'click', () => navigateMatch(1));

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
        if (files.length > 0 && !currentFileName) {
            displayFileContentFromContents(files[0].name);
        }
    }

    // 渲染文件列表
    function renderFileList() {
        fileListContainer.innerHTML = '';
        files.forEach( (file, index) => {
            const fileItem = _c('div');
            fileItem.className = `file-item ${file.name === currentFileName ? 'active' : ''}`;
            fileItem.textContent = file.name;
            fileContents[file.name] = null;
            _on(fileItem, 'click', () => displayFileContentFromContents(file.name));
            fileListContainer.appendChild(fileItem);
        }
        );
    }

    // 读word文件内容
    function readWordFile(file,cb) {
        const reader = new FileReader();
        //const arrayBuffer = file.arrayBuffer();
        //const text = await file.text();
        reader.onload = function(event) {
            const arrayBuffer = event.target.result;
            mammoth.convertToHtml({
                arrayBuffer
            }, {
                // styleMap: ["w[color='EE0000'] => span.docx-color-red", "w[color='#EE0000'] => span.docx-color-red", "r[color='EE0000'] => span.docx-color-red", "r[color='#EE0000'] => span.docx-color-red", "r[style-name='0000FF'] => span.docx-color-blue", "r[style-name='008000'] => span.docx-color-green", "r[style-name='808080'] => span.docx-color-gray", "r[style-name='ffff00'] => span.docx-color-yellow", "r[style-name] => span.docx-color-custom[style='color:${color};']", "r:not([style-name]) => span"],
                // transformDocument: mammoth.transforms.paragraph(element => {
                //   if (element.color) {
                //     return {
                //       ...element,
                //       style: `--docx-color: #${element.color};`
                //     };
                //   }
                //   return element;
                // })
            }).then(result=>{
                cb(result.value);
            });
            //return result.value;
        }
        return reader.readAsArrayBuffer(file);
        // var options = { inWrapper: false, ignoreWidth: true, ignoreHeight: true, className:'pj-docx', ignoreFonts‌: true};
        // var hiddenDiv = _c("div");
        // var result = await docx.renderAsync(file, hiddenDiv, null, options);
        // console.log("docx: finish",result);
        // return hiddenDiv.innerHTML;
        // .then(x => {console.log("docx: finished",x));
    }

    function afterDisplayFileContent() {
        updateActiveFileStyle();
        ensureScrollbars();
    }

    // 从内存中显示文件内容
    function displayFileContentFromContents(fileName){
        const fileContent = fileContents[fileName];
        if(fileContent == null){
            readFileByName(fileName);
        }
        contentDisplay.innerHTML = fileContent;
        currentFileName = fileName;
        afterDisplayFileContent();
    }
    function readFileByName(fileName, cb){
        const file = files.find(file=>file.name == fileName);
        if(file.name.endsWith('.docx')){
            const fileName = file.name;
            readWordFile(file, (content)=>{
                fileContents[fileName] = content;
                if(currentFileName = fileName){
                    displayFileContentFromContents(fileName);
                }
                cb && cb(content);
            });
        }else{
            readTextFile(file,(content)=>{
                fileContents[fileName] = content;
                if(currentFileName = fileName){
                    displayFileContentFromContents(fileName);
                }
                cb && cb(content);
            })
        }
    }
    // 显示文件内容
    function readTextFile(file, cb) {
        currentFileName = file.name;
        const reader = new FileReader();

        reader.onload = function(e) {
            const fileContent = e.target.result;
            contentDisplay.innerHTML = fileContent;
            fileContents[file.name] = fileContent;
            afterDisplayFileContent();
            cb(fileContent);
        }
        reader.readAsText(file);
    }

    // 更新活动文件样式
    function updateActiveFileStyle() {
        document.querySelectorAll('.file-item').forEach( (item, index) => {
            item.classList.toggle('active', item.textContent === currentFileName);
        }
        );
    }

    //执行文件内容的匹配及渲染搜索结果
    function matchSeatchAndDisplay(searchResults, fileName, searchTerm) {
        const content = fileContents[fileName];
        if(!content){
            readFileByName(fileName, ()=>{
                matchSeatchAndDisplay(searchResults, fileName, searchTerm);
            });
        }
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
            searchResults[fileName] = matches;
            renderSearchResult(fileName, matches);
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

        for(let fileName in fileContents){
            //const content = fileContents[fileName];
            //所有文件处理完再提示
            filesProcessed++;
            const currentHasResults = matchSeatchAndDisplay(searchResults, fileName, searchTerm);
            if(currentHasResults){
                hasResults = true;
            }
            if (filesProcessed === files.length) {
                finishSearchFiles(hasResults);
            }
        }

        // 如果没有文件需要处理，立即提示
        if (files.length === 0) {
            showNotification('没有可搜索的文件');
        }
    }

    // 渲染搜索结果
    function renderSearchResult(fileName, matches) {
        const resultGroup = _c('div');
        resultGroup.className = 'result-group';

        const resultHeader = _c('div');
        resultHeader.className = 'result-header';
        resultHeader.innerHTML = `
            <span>${fileName} (${matches.length}处匹配)</span>
            <span>▶</span>
        `;

        const resultContent = _c('div');
        resultContent.className = 'result-content';

        matches.forEach( (match, matchIndex) => {
            const matchItem = _c('div');
            matchItem.className = 'match-item';
            matchItem.innerHTML = `...${highlightMatch(match.context, searchInput.value)}...`;
            _on(matchItem, 'click', () => {
                displayFileContentFromContents(fileName);
                highlightMatchesInCurrentFile();
                scrollToMatch(fileName, matchIndex);
            }
            );
            resultContent.appendChild(matchItem);
        }
        );

        _on(resultHeader, 'click', () => {
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
        if (!currentFileName || !searchResults[currentFileName])
            return;

        //const content = contentDisplay.innerHTML;
        const content = fileContents[currentFileName];
        const matches = searchResults[currentFileName];
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
        if (!currentFileName || !searchResults[currentFileName])
            return;

        const matches = searchResults[currentFileName];
        let newIndex = currentMatch.matchIndex + direction;

        if (newIndex < 0) {
            newIndex = matches.length - 1;
        } else if (newIndex >= matches.length) {
            newIndex = 0;
        }

        scrollToMatch(currentFileName, newIndex);
    }

    // 滚动到匹配项
    function scrollToMatch(fileName, matchIndex) {
        if (fileName !== currentFileName) {
            displayFileContentFromContents(fileName);
        }

        currentMatch = {
            fileName,
            matchIndex
        };
        const highlighted = _findAll(contentDisplay, '.highlight');

        if (highlighted && highlighted.length > matchIndex) {
            for(let i=0;i<highlighted.length;i++){
                let className = highlighted[i].className;
                highlighted[i].className = className.replace(" current-view","");
            }
            let currentHighlight = highlighted[matchIndex];
            currentHighlight.className=currentHighlight.className+" current-view";
            currentHighlight.scrollIntoView({
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
