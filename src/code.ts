function settings_(props: GoogleAppsScript.Properties.Properties) {
  return {
    // watch(channel 作成)用のリソース
    resource: {
      // channel の識別子
      id: Utilities.getUuid(),
      // 固定
      type: 'web_hook',
      // 使用は任意(pageToken とは関係ない)
      token: '',
      // channel の有効期限、単位は ms
      // 今回は 31 分で設定
      expiration: `${new Date(Date.now() + 60 * 31 * 1000).getTime()}`,
      // 通知を受け取る URL
      address: props.getProperty('address') || ''
    },
    // 通知を書き込むスプレッドシート
    sheetId: props.getProperty('sheet_id') || '',
    sheetName: props.getProperty('sheet_name') || ''
  }
}

function doGet(e: GoogleAppsScript.Events.DoGet) {}
function doPost(e: GoogleAppsScript.Events.DoPost) {
  if (e.postData && e.postData.contents) {
    const lock = LockService.getScriptLock()
    if (lock.tryLock(10 * 1000)) {
      try {
        // 初期設定
        const props = PropertiesService.getScriptProperties()
        const settings = settings_(props)

        // 保存しておいた pege token を取得
        const pageToken = props.getProperty('page_token')

        // page token を利用して変更されたファイルの一覧取得
        const res = Drive.Changes?.list({ pageToken })
        if (res?.items) {
          res.items[0].kind
          const items = res.items
            .filter(
              (item) =>
                item.file &&
                item.file.id !== settings.sheetId &&
                item.file.mimeType !== 'application/vnd.google-apps.folder'
            )
            .map((item) => {
              return [
                item.file?.title,
                item.file?.id,
                item.file?.labels?.trashed ? 'trashed' : ''
              ]
            })
          //props.setProperty('items', JSON.stringify(items, null, ' '))
          //console.log(JSON.stringify(res, null, ' '))
          // スプレッドシートへ書き込み
          const sheet = SpreadsheetApp.openById(
            settings.sheetId
          ).getSheetByName(settings.sheetName)
          if (sheet) {
            sheet
              .insertRowsBefore(1, items.length)
              .getRange(1, 1, items.length, 3)
              .setValues(items)
          }
        }

        // 新しい page token を保存
        props.setProperty('page_token', res?.newStartPageToken || '')
      } catch (e: any) {
        console.error(e)
      } finally {
        lock.releaseLock()
      }
    }
  }
}

function reset() {
  // 初期設定
  const props = PropertiesService.getScriptProperties()
  const settings = settings_(props)

  // start page token をスクリプトプロパティへ保存
  const resToken = Drive.Changes?.getStartPageToken()
  const pageToken = JSON.parse(resToken as string).startPageToken
  props.setProperty('page_token', pageToken)

  // watch(channel 作成)用のリソース準備

  // watch 開始
  const res = Drive.Changes?.watch(settings.resource)
  console.log(JSON.stringify(res, null, ' '))

  // 作成済の channel を停止(一時的に 2 つの channel が存在する)
  try {
    stop()
  } catch (e: any) {
    console.error(e)
  }

  // 各種 id をスクリプトプロパティへ保存(watch 停止時に使う)
  props.setProperty('channle_id', settings.resource.id)
  props.setProperty('resource_id', res?.resourceId || '')
}

function stop() {
  const props = PropertiesService.getScriptProperties()

  // 各種 id を取得
  const id = props.getProperty('channle_id') || ''
  const resourceId = props.getProperty('resource_id') || ''

  if (id !== '') {
    // watch 停止
    const res = Drive.Channels?.stop({
      id,
      resourceId
    })
    console.log(JSON.stringify(res, null, ' '))
  }
}

// function print() {
//   const props = PropertiesService.getScriptProperties()
//   console.log(props.getProperty('items') || '')
// }
