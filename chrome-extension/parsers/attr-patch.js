/**
 * 属性提取补丁 v3 — 三列布局优先，忽略原始提取器的垃圾结果
 */
(function() {
  'use strict';
  
  function doPatch() {
    try {
      if (!window.__ERP_PARSERS__ || !window.__ERP_PARSERS__.SpecParser) return;
      
      // 加载已训练的选择器
      try {
        chrome.storage.local.get('trainedAttrSelector', function(result) {
          if (result.trainedAttrSelector) {
            window.__trainedAttrSelector = result.trainedAttrSelector;
            console.log('[AttrPatch] 已加载训练选择器');
          }
        });
      } catch(e) {}
      
      window.__ERP_PARSERS__.SpecParser.extractAttributes = function() {
        var seen = {};
        var attrs = [];
        
        // 优先使用训练好的选择器
        try {
          if (window.__trainedAttrSelector) {
            var sel = window.__trainedAttrSelector;
            var containers = document.querySelectorAll(sel.containerSelector);
            containers.forEach(function(c) {
              var children = c.querySelectorAll(sel.childSelector || ':scope > div, :scope > span');
              if (children.length > sel.valueIndex) {
                var nm = children[sel.nameIndex || 0].textContent.replace(/[：:]/g,'').trim();
                var vl = children[sel.valueIndex || 1].textContent.replace(/[：:]/g,'').trim();
                if (nm && vl && nm.length < 100 && !seen[nm]) {
                  seen[nm] = true;
                  attrs.push({ name: nm, value: vl, unit: null });
                }
              }
            });
            if (attrs.length > 0) return attrs;
          }
        } catch(e) {}
        
        // 从三列布局 data-testid 行提取
        try {
          var rows = document.querySelectorAll('[data-testid="three-column-key-attributes-row"]');
          rows.forEach(function(r) {
            var divs = r.querySelectorAll(':scope > div');
            if (divs.length >= 2) {
              var nm = divs[0].textContent.replace(/[：:]/g,'').trim();
              var vl = divs[1].textContent.replace(/[：:]/g,'').trim();
              if (nm && vl && nm.length < 100 && !seen[nm]) {
                seen[nm] = true;
                attrs.push({ name: nm, value: vl, unit: null });
              }
            }
          });
        } catch(e) {}
        
        // 如果三列布局没找到，再尝试从页面文本解析
        if (attrs.length === 0) {
          try {
            // 找 Key Attributes 段落
            var allP = document.querySelectorAll('[data-testid="three-column-key-attributes"] p');
            var texts = [];
            allP.forEach(function(p) { texts.push(p.textContent.trim()); });
            // p标签成对：奇数为属性名，偶数为属性值
            for (var i = 0; i < texts.length - 1; i += 2) {
              var n = texts[i], v = texts[i+1];
              if (n && v && n.length < 80 && v.length < 300 && !seen[n]) {
                seen[n] = true;
                attrs.push({ name: n, value: v, unit: null });
              }
            }
          } catch(e) {}
        }
        
        return attrs;
      };
      
      console.log('[AttrPatch] v3 已加载');
    } catch(e) {
      console.warn('[AttrPatch] 加载失败:', e);
    }
  }
  
  if (document.readyState === 'complete') doPatch();
  else window.addEventListener('load', doPatch);
})();
