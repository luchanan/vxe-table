import XEUtils from 'xe-utils/methods/xe-utils'
import { UtilTools, DomTools } from '../../tools'

function getContent ($table, opts, oColumns, fullData) {
  const { type } = opts
  const { columns, datas } = getExportData($table, opts, fullData, oColumns)
  if (type === 'csv') {
    return toCsv($table, opts, columns, datas)
  } else if (type === 'html') {
    return toHtml($table, opts, columns, datas)
  }
  return ''
}

function toCsv ($table, opts, columns, datas) {
  const isOriginal = opts.original
  let content = '\ufeff'
  if (opts.isHeader) {
    content += columns.map(({ own }) => `"${UtilTools.getFuncText(own.title || own.label)}"`).join(',') + '\n'
  }
  datas.forEach((row, rowIndex) => {
    if (isOriginal) {
      content += columns.map(column => {
        if (column.type === 'index') {
          return `"${column.indexMethod ? column.indexMethod(rowIndex) : rowIndex + 1}"`
        }
        return `"${UtilTools.getCellValue(row, column) || ''}"`
      }).join(',') + '\n'
    } else {
      content += columns.map(column => `"${row[column.id]}"`).join(',') + '\n'
    }
  })
  if (opts.isFooter) {
    let footerData = $table.footerData
    let footers = opts.footerFilterMethod ? footerData.filter(opts.footerFilterMethod) : footerData
    let filterMaps = $table.tableColumn.map(column => columns.includes(column))
    footers.forEach(rows => {
      content += rows.filter((val, colIndex) => `"${filterMaps[colIndex]}"`).join(',') + '\n'
    })
  }
  return content
}

function toHtml ($table, opts, columns, datas) {
  const isOriginal = opts.original
  let html = '<table>'
  if (opts.isHeader) {
    html += '<thead><tr><th>' + columns.map(({ own }) => UtilTools.getFuncText(own.title || own.label)).join('</th><th>') + '</th></tr></thead>'
  }
  html += '<tbody>'
  datas.forEach((row, rowIndex) => {
    html += '<tr>'
    if (isOriginal) {
      html += '<td>' + columns.map(column => {
        if (column.type === 'index') {
          return `${column.indexMethod ? column.indexMethod(rowIndex) : rowIndex + 1}`
        }
        return `${UtilTools.getCellValue(row, column) || ''}`
      }).join('</td><td>') + '</td>'
    } else {
      html += '<td>' + columns.map(column => `${row[column.id]}`).join('</td><td>') + '</td>'
    }
    html += '</tr>'
  })
  html += '</tbody>'
  if (opts.isFooter) {
    let footerData = $table.footerData
    let footers = opts.footerFilterMethod ? footerData.filter(opts.footerFilterMethod) : footerData
    let filterMaps = $table.tableColumn.map(column => columns.includes(column))
    if (footers.length) {
      html += '<tfoot>'
      footers.forEach(rows => {
        html += '<tr><td>' + rows.filter((val, colIndex) => filterMaps[colIndex]).join('</td><td>') + '</td></tr>'
      })
      html += '</tfoot>'
    }
  }
  return html + '</table>'
}

function downloadFile (opts, content) {
  const { filename, type, download } = opts
  const name = `${filename}.${type}`
  if (!download) {
    return Promise.resolve(content)
  }
  if (navigator.msSaveBlob && window.Blob) {
    navigator.msSaveBlob(new Blob([content], { type: `text/${type}` }), name)
  } else if (DomTools.browse['-ms']) {
    var win = window.top.open('about:blank', '_blank')
    win.document.charset = 'utf-8'
    win.document.write(content)
    win.document.close()
    win.document.execCommand('SaveAs', name)
    win.close()
  } else {
    var linkElem = document.createElement('a')
    linkElem.target = '_blank'
    linkElem.download = name
    linkElem.href = getDownloadUrl(opts, content)
    document.body.appendChild(linkElem)
    linkElem.click()
    document.body.removeChild(linkElem)
  }
}

function getLabelData ($table, columns, datas) {
  return datas.map(row => {
    let item = {}
    columns.forEach(column => {
      let cell = DomTools.getCell($table, { row, column })
      item[column.id] = cell ? cell.innerText.trim() : ''
    })
    return item
  })
}

function getExportData ($table, opts, fullData, oColumns) {
  let columns = opts.columns ? opts.columns : oColumns
  let datas = opts.data || fullData
  if (opts.columnFilterMethod) {
    columns = columns.filter(opts.columnFilterMethod)
  }
  if (opts.dataFilterMethod) {
    datas = datas.filter(opts.dataFilterMethod)
  }
  return { columns, datas: opts.original ? datas : getLabelData($table, columns, datas) }
}

function getDownloadUrl (opts, content) {
  switch (opts.type) {
    case 'csv':
    case 'html':
      return getCsvAndHtmlUrl(opts, content)
  }
  return ''
}

function getCsvAndHtmlUrl ({ type }, content) {
  if (window.Blob && window.URL && window.URL.createObjectURL && !DomTools.browse.safari) {
    return URL.createObjectURL(new Blob([content], { type: `text/${type}` }))
  }
  return `data:attachment/${type};charset=utf-8,${encodeURIComponent(content)}`
}

export default {
  methods: {
    // 在 v3.0 中废弃 exportCsv 方法
    _exportCsv (options) {
      return this._exportData(options)
    },
    /**
     * 导出文件，支持 csv/html/xml
     * 如果是树表格，则默认是导出所有节点
     * 如果是启用了虚拟滚动，则只能导出数据源，可以配合 dataFilterMethod 函数自行转换数据
     * @param {Object} options 参数
     */
    _exportData (options) {
      let { visibleColumn, scrollXLoad, scrollYLoad, treeConfig } = this
      let opts = Object.assign({
        filename: '',
        original: !!treeConfig,
        isHeader: true,
        isFooter: true,
        download: true,
        type: '',
        data: null,
        columns: null,
        columnFilterMethod: null,
        dataFilterMethod: null,
        footerFilterMethod: null
      }, options)
      if (!opts.filename) {
        opts.filename = 'table'
      }
      if (!['csv', 'html'].includes(opts.type)) {
        opts.type = 'csv'
      }
      if (!opts.original) {
        if (scrollXLoad || scrollYLoad) {
          opts.original = true
          UtilTools.warn('vxe.error.scrollOriginal')
        }
      }
      if (!options || !options.columns) {
        // 在 v3.0 中废弃 type=selection
        opts.columnFilterMethod = column => column.property && ['index', 'checkbox', 'selection', 'radio'].indexOf(column.type) === -1
      }
      let columns = visibleColumn
      let fullData = this.tableFullData
      if (treeConfig) {
        fullData = XEUtils.toTreeArray(fullData, treeConfig)
      }
      return downloadFile(opts, getContent(this, opts, columns, fullData))
    }
  }
}
