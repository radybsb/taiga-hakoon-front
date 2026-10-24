###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

class WysiwygService
    @.$inject = [
        "tgProjectService",
        "tgAttachmentsFullService",
        "tgAttachmentsService",
        "$sce",
        "tgWysiwygLayoutService"
    ]

    constructor: (@projectService, @attachmentsFullService, @attachmentsService, @sce, @layout) ->
        @.projectDataConversion = {}
        # prevent duplicate calls to the same attachment
        @.cache = {}

    getMarkdown: (html) ->
        projectId = @projectService.project.get('id')

        if !@.projectDataConversion[projectId]
            @.dataConversion = window.angularDataConversion()
            @.dataConversion.setUp(@projectService.project.get('slug'))
            @layout?.preserveConversion(@dataConversion)
            @.projectDataConversion[projectId] = @.dataConversion

        return @.projectDataConversion[projectId].toMarkdown(html)

    getHTML: (text) ->
        return "" if !text || !text.length

        projectId = @projectService.project.get('id')

        if !@.projectDataConversion[projectId]
            @.dataConversion = window.angularDataConversion()
            @.dataConversion.setUp(@projectService.project.get('slug'))
            @layout?.preserveConversion(@dataConversion)
            @.projectDataConversion[projectId] = @.dataConversion

        return @.projectDataConversion[projectId].toHtml(text)

    uploadEditorFile: (upload, file, callback) ->
        upload(file, (result) ->
            # AttachFile needs a label to insert non-image attachments.
            callback(Object.assign({}, result, {text: result.text || file.name}))
        )

    isVideoAttachmentURL: (value) ->
        return false unless value

        try
            url = new URL(value, window.location.href)

            return false unless url.protocol in ['http:', 'https:']
            return false unless url.pathname.startsWith('/media/attachments/')

            # Primeiro ciclo: somente MP4.
            return /\.mp4$/i.test(url.pathname)
        catch
            return false

    appendVideoPlayers: (root) ->
        root.querySelectorAll('a[href]').forEach (link) =>
            href = link.getAttribute('href')
            return unless @isVideoAttachmentURL(href)

            # Evita acrescentar um segundo player ao mesmo link.
            return if link.parentElement?.classList.contains('inline-video')

            wrapper = document.createElement('span')
            wrapper.className = 'inline-video'

            video = document.createElement('video')
            video.setAttribute('controls', '')
            video.setAttribute('playsinline', '')
            video.setAttribute('preload', 'metadata')
            video.setAttribute('aria-label', link.textContent || 'Vídeo anexado')
            video.src = href

            link.parentNode.insertBefore(wrapper, link)
            wrapper.appendChild(video)
            link.remove()
        @applyMediaSizes(root)

    # Install converters through the CKEditor instance exposed on its editable DOM.
    # Store links in data/Markdown; players exist only in the editing view.
    enableEditorVideos: (editor, reload = true) ->
        return if editor.model.schema.isRegistered('taigaInlineVideo')

        service = @
        editor.model.schema.register 'taigaInlineVideo', {
            isInline: true
            isObject: true
            allowWhere: '$text'
            allowAttributes: ['src', 'label']
        }

        labelOf = (element) ->
            Array.from(element.getChildren()).map((child) ->
                if child.is('$text') then child.data else if child.getChildren then labelOf(child) else ''
            ).join('')

        editor.conversion.for('upcast').elementToElement {
            view: (element) ->
                return null unless element.name == 'a' && service.isVideoAttachmentURL(element.getAttribute('href'))
                return {name: true, attributes: ['href']}
            model: (element, api) ->
                api.writer.createElement('taigaInlineVideo', {
                    src: element.getAttribute('href')
                    label: labelOf(element) || 'Vídeo anexado'
                })
            converterPriority: 'high'
        }

        editor.conversion.for('dataDowncast').elementToElement {
            model: 'taigaInlineVideo'
            view: (element, api) ->
                writer = api.writer
                link = writer.createContainerElement('a', {href: element.getAttribute('src')})
                writer.insert(writer.createPositionAt(link, 0), writer.createText(element.getAttribute('label')))
                return link
        }

        editor.conversion.for('editingDowncast').elementToElement {
            model: 'taigaInlineVideo'
            view: (element, api) ->
                writer = api.writer
                wrapper = writer.createContainerElement('span', {
                    class: 'inline-video ck-widget'
                    contenteditable: 'false'
                })
                writer.setCustomProperty('widget', true, wrapper)
                writer.setCustomProperty('getLabel', (() -> element.getAttribute('label')), wrapper)
                wrapper.getFillerOffset = -> null
                player = writer.createUIElement 'span', {class: 'inline-video-player'}, (domDocument) ->
                    dom = @toDomElement(domDocument)
                    video = domDocument.createElement('video')
                    video.controls = true
                    video.preload = 'metadata'
                    video.setAttribute('playsinline', '')
                    video.setAttribute('aria-label', element.getAttribute('label'))
                    video.src = element.getAttribute('src')
                    dom.appendChild(video)
                    return dom
                writer.insert(writer.createPositionAt(wrapper, 0), player)
                # Inline widgets are skipped by WidgetTypeAround's automatic UI
                # injection. Reuse its control markup and paragraph command so
                # videos retain inline layout with the same paragraph actions.
                if editor.plugins.has('WidgetTypeAround')
                    controls = writer.createUIElement 'span', {class: 'ck ck-reset_all ck-widget__type-around'}, (domDocument) ->
                        dom = @toDomElement(domDocument)
                        for side in ['before', 'after']
                            button = domDocument.createElement('div')
                            button.className = "ck ck-widget__type-around__button ck-widget__type-around__button_#{side}"
                            button.title = if side == 'before' then editor.t('Insert paragraph before block') else editor.t('Insert paragraph after block')
                            button.innerHTML = '<svg viewBox="0 0 10 8" xmlns="http://www.w3.org/2000/svg"><path d="M9.055.263v3.972h-6.77M1 4.216l2-2.038M1 4.178l2 2.038"/></svg>'
                            dom.appendChild(button)
                        return dom
                    writer.insert(writer.createPositionAt(wrapper, 'end'), controls)
                return wrapper
        }

        editor.conversion.for('dataDowncast').attributeToAttribute {
            model: {name: 'taigaInlineVideo', key: 'src'}
            view: 'href'
        }

        # At paragraph edges insert outside the containing paragraph, avoiding
        # an extra empty paragraph from splitting an inline video's container.
        onParagraphButton = (event, data) ->
            button = data.domTarget.closest?('.inline-video .ck-widget__type-around__button')
            return unless button
            data.preventDefault()
            event.stop()
            return if editor.isReadOnly
            widget = editor.editing.view.domConverter.mapDomToView(button.closest('.inline-video'))
            media = editor.editing.mapper.toModelElement(widget)
            return unless media?.name == 'taigaInlineVideo'
            before = button.classList.contains('ck-widget__type-around__button_before')
            side = if before then 'before' else 'after'
            target = media
            if media.parent.is('element', 'paragraph')
                siblings = Array.from(media.parent.getChildren())
                edge = if before then siblings.slice(0, media.index) else siblings.slice(media.index + 1)
                if edge.every((node) -> node.is('$text') && /^\s*$/.test(node.data))
                    target = media.parent
            editor.execute('insertParagraph', {position: editor.model.createPositionAt(target, side)})
            editor.editing.view.focus()
            editor.editing.view.scrollToTheSelection()
        editor.editing.view.document.on('mousedown', onParagraphButton, {priority: 'highest'})
        editor.on 'destroy', -> editor.editing.view.document.off('mousedown', onParagraphButton)

        # AttachFile inserts uploaded non-images as linked text. Convert those
        # links within the same model transaction, retaining undo/redo support.
        editor.model.document.registerPostFixer (writer) ->
            for rootName in editor.model.document.getRootNames()
                root = editor.model.document.getRoot(rootName)
                for entry in Array.from(editor.model.createRangeIn(root).getWalker())
                    item = entry.item
                    continue unless item.is('$textProxy')
                    src = item.getAttribute('linkHref')
                    continue unless service.isVideoAttachmentURL(src)
                    continue unless editor.model.schema.checkChild(entry.previousPosition, 'taigaInlineVideo')
                    node = writer.createElement('taigaInlineVideo', {src: src, label: item.data})
                    position = entry.previousPosition
                    writer.remove(writer.createRange(position, entry.nextPosition))
                    writer.insert(node, position)
                    return true
            return false

        # Reload the current data once so existing MP4 links use the converters.
        editor.setData(editor.getData()) if reload

    initializeEditorMedia: (editor) ->
        return if editor._taigaMediaInitialized
        # CKEditor has already parsed its first value without our row schema.
        # Preserve the component's original HTML before any change event can
        # replace it with that normalized (and flattened) model.
        editable = editor.ui.getEditableElement()
        strategy = editable.closest('tg-text-editor')?.ngElementStrategy
        component = (strategy?.componentRef || strategy?.strategy?.componentRef)?.instance
        source = component?.contentHtml
        source = editor.config.get('initialData') unless typeof source == 'string'
        source = editor.getData() unless typeof source == 'string'
        @enableEditorVideos(editor, false)
        @layout?.enable(editor)
        editor._taigaMediaInitialized = true
        editor.setData(source)
        @enableMediaResize(editor)

    observeEditorVideos: (root) ->
        pending = new Map()
        attach = =>
            root.querySelectorAll('.ck-editor__editable').forEach (editable) =>
                editor = editable.ckeditorInstance
                return unless editor
                if editor.state == 'ready'
                    @initializeEditorMedia(editor)
                else if editor.state == 'initializing' && !pending.has(editor)
                    onReady = =>
                        pending.delete(editor)
                        @initializeEditorMedia(editor)
                    pending.set(editor, onReady)
                    editor.once('ready', onReady)
        observer = new MutationObserver(attach)
        observer.observe(root, {childList: true, subtree: true})
        attach()
        return ->
            observer.disconnect()
            pending.forEach (callback, editor) -> editor.off('ready', callback)
            pending.clear()

    # URL fragments survive HTML/Markdown conversion and never reach the server.
    # Preserve attachment refresh metadata when storing the requested pixel width.
    mediaWidth: (src) ->
        match = /(?:#|&)_taiga-width=(\d+)(?:&|$)/.exec(src || '')
        width = Number(match[1]) if match
        return width if width >= 48 && width <= 4096

    sizedMediaURL: (src, width) ->
        clean = src.replace(/([#&])_taiga-width=\d+(&|$)/, (match, separator, end) ->
            if end then separator else ''
        )
        separator = if clean.indexOf('#') == -1 then '#' else '&'
        return clean + separator + '_taiga-width=' + Math.round(width)

    applyMediaSizes: (root) ->
        root.querySelectorAll('img, video').forEach (media) =>
            width = @mediaWidth(media.getAttribute('src'))
            media.style.width = if width then width + 'px' else ''
            media.style.maxWidth = '100%'
            media.style.height = 'auto'
            media.style.maxHeight = 'none' if width && media.tagName == 'VIDEO'

    enableMediaResize: (editor) ->
        return if editor._taigaMediaResize
        editor._taigaMediaResize = true
        editable = editor.ui.getEditableElement()
        overlay = document.createElement('div')
        overlay.className = 'taiga-media-resize'
        overlay.hidden = true
        # Keep resize chrome inside the content's stacking context, below the
        # toolbar dropdowns rather than above every overlay on the page.
        overlayRoot = editable.parentElement
        overlayRoot.appendChild(overlay)
        selected = null
        drag = null
        service = @
        position = ->
            if !selected || !editable.contains(selected) || !editable.closest('.edit-mode')
                overlay.hidden = true
                return
            rect = selected.getBoundingClientRect()
            overlay.hidden = false
            containerRect = overlayRoot.getBoundingClientRect()
            overlay.style.left = (rect.left - containerRect.left + overlayRoot.scrollLeft - overlayRoot.clientLeft) + 'px'
            overlay.style.top = (rect.top - containerRect.top + overlayRoot.scrollTop - overlayRoot.clientTop) + 'px'
            overlay.style.width = rect.width + 'px'
            overlay.style.height = rect.height + 'px'
        modelOf = (media) ->
            widget = media.closest('.ck-widget')
            return unless widget
            view = editor.editing.view.domConverter.mapDomToView(widget)
            return editor.editing.mapper.toModelElement(view) if view
        sync = ->
            editable.querySelectorAll('.inline-video').forEach (widget) ->
                video = widget.querySelector('video')
                model = modelOf(video) if video
                if model && video.getAttribute('src') != model.getAttribute('src')
                    video.src = model.getAttribute('src')
            service.applyMediaSizes(editable)
            position()
        sizeObserver = new ResizeObserver(position)
        sizeObserver.observe(overlayRoot)
        sizeObserver.observe(editable)
        select = (event) ->
            return if editor.isReadOnly
            sizeObserver.unobserve(selected) if selected
            selected = event.target.closest('img, video')
            sizeObserver.observe(selected) if selected
            position()
        move = (event) ->
            return unless drag
            return if event.pointerId? && drag.pointerId? && event.pointerId != drag.pointerId
            # Native video controls may swallow pointerup. Do not keep resizing
            # if a later movement reports that the mouse button is released.
            return finish(event) if event.buttons == 0
            delta = ((event.clientX - drag.x) * drag.horizontal + (event.clientY - drag.y) * drag.vertical * drag.ratio) / (1 + drag.ratio * drag.ratio)
            drag.width = Math.round(Math.max(48, Math.min(drag.max, drag.start + delta)))
            selected.style.width = drag.width + 'px'
            position()
            event.preventDefault()
        releasePointer = (current) ->
            try
                current.handle.releasePointerCapture(current.pointerId) if current.pointerId? && current.handle.hasPointerCapture?(current.pointerId)
            catch
                # The browser may already have released capture on cancellation.
                return
        finish = (event) ->
            return unless drag
            return if event?.pointerId? && drag.pointerId? && event.pointerId != drag.pointerId
            current = drag
            drag = null
            releasePointer(current)
            if current.width != current.start && current.model && !editor.isReadOnly
                editor.model.change (writer) ->
                    writer.setAttribute('src', service.sizedMediaURL(current.model.getAttribute('src'), current.width), current.model)
            sync()
        for corner in ['nw', 'ne', 'sw', 'se']
            do (corner) ->
                handle = document.createElement('span')
                handle.className = 'taiga-media-resize-handle ' + corner
                overlay.appendChild(handle)
                handle.addEventListener 'pointerdown', (event) ->
                    return unless selected && !editor.isReadOnly
                    return if drag || (event.button? && event.button != 0)
                    model = modelOf(selected)
                    return unless model && model.getAttribute('src')
                    rect = selected.getBoundingClientRect()
                    return unless rect.width && rect.height
                    drag = {
                        model: model, x: event.clientX, y: event.clientY
                        handle: handle, pointerId: event.pointerId
                        start: rect.width, width: rect.width, ratio: rect.height / rect.width
                        horizontal: if corner[1] == 'e' then 1 else -1
                        vertical: if corner[0] == 's' then 1 else -1
                        max: Math.max(48, Math.min(4096, editable.clientWidth))
                    }
                    try
                        handle.setPointerCapture?(event.pointerId) if event.pointerId?
                    catch
                        # Window capture listeners remain a fallback.
                        null
                    event.preventDefault()
                    event.stopPropagation()
                handle.addEventListener('lostpointercapture', finish)
        editable.addEventListener('click', select)
        editable.addEventListener('loadedmetadata', position, true)
        editable.addEventListener('resize', position, true)
        editable.addEventListener('load', position, true)
        window.addEventListener('pointermove', move, true)
        window.addEventListener('pointerup', finish, true)
        window.addEventListener('pointercancel', finish, true)
        window.addEventListener('scroll', position, true)
        window.addEventListener('resize', position)
        window.addEventListener('blur', finish)
        modeObserver = new MutationObserver(position)
        modeRoot = editable.closest('tg-wysiwyg')
        modeObserver.observe(modeRoot, {attributes: true, subtree: true, attributeFilter: ['class']}) if modeRoot
        observer = new MutationObserver(sync)
        observer.observe(editable, {childList: true, subtree: true, attributes: true, attributeFilter: ['src']})
        editor.model.document.on('change:data', sync)
        sync()
        editor.once 'destroy', ->
            if drag
                current = drag
                drag = null
                releasePointer(current)
            observer.disconnect()
            sizeObserver.disconnect()
            modeObserver.disconnect()
            editor.model.document.off('change:data', sync)
            editable.removeEventListener('click', select)
            editable.removeEventListener('loadedmetadata', position, true)
            editable.removeEventListener('resize', position, true)
            editable.removeEventListener('load', position, true)
            window.removeEventListener('pointermove', move, true)
            window.removeEventListener('pointerup', finish, true)
            window.removeEventListener('pointercancel', finish, true)
            window.removeEventListener('scroll', position, true)
            window.removeEventListener('resize', position)
            window.removeEventListener('blur', finish)
            overlay.remove()

    getAttachmentData: (tokens) ->
        return @attachmentsService.get(tokens[0], tokens[1]).then (response) => response.data.url

    getCachedAttachment: (tokens) ->
        attachmentId = parseInt(tokens[1], 10)

        attachments = @attachmentsFullService.attachments.toJS()
        attachment = attachments.find (attachment) => attachment.file.id == attachmentId

        if attachment
            return Promise.resolve(attachment.file.url)
        else
            cache_key = tokens[0] + tokens[1]
            cached_result = @.cache[cache_key]

            if cached_result
                return Promise.resolve(cached_result)
            else
                return @.getAttachmentData(tokens).then (url) =>
                    @.cache[cache_key] = url
                    return url

    relativePaths: (html, baseURL = window.location.href) ->
        el = document.createElement('html')

        window._extraValidHtmlElments = {input: true}
        window._extraValidAttrs = {checked: true}

        el.innerHTML = @sce.getTrustedHtml(html) || ''

        el.querySelectorAll('a').forEach (link) =>
            href = link.getAttribute('href')

            if href && !href.startsWith('http') && !href.startsWith('/') && !link.classList.contains('mention')
                currentHref = baseURL.slice(
                    0,
                    baseURL.lastIndexOf('/') + 1
                );

                if !currentHref.endsWith('/')
                    currentHref = currentHref + '/'

                newHref = if href.startsWith('#') then new URL(href, baseURL).href else currentHref + href
                link.removeAttribute('rel')
                link.removeAttribute('target')

                link.setAttribute('href', newHref)

            if href.startsWith('project') && link.classList.contains('mention')
                link.removeAttribute('rel')
                link.removeAttribute('target')

        return el.innerHTML

    refreshAttachmentURLFromMarkdown: (markdown) ->
        html = @.getHTML(markdown)

        return @.refreshAttachmentURL(html).then (html) =>
            return @.getMarkdown(html)

    refreshAttachmentURL: (html) ->
        el = document.createElement('html')

        window._extraValidHtmlElments = {input: true}
        window._extraValidAttrs = {checked: true}

        el.innerHTML = @sce.getTrustedHtml(html) || ''
        regex = /#_taiga-refresh=([a-zA-Z]*\:\d+)/

        links = {
            "elements": el.querySelectorAll('a'),
            "attr": "href",
        }
        images = {
            "elements": el.querySelectorAll('img'),
            "attr": "src",
        }

        promises = []
        _.map [links, images], (tag) =>
            _.map tag.elements, (e) =>
                attrValue = e.getAttribute(tag.attr)

                if attrValue && attrValue.indexOf && attrValue.indexOf('#_taiga-refresh=') != -1
                    match = attrValue.match(regex)
                    if match && match.length == 2
                        tokens = match[1].split(":")

                        promise = @.getCachedAttachment(tokens)
                        .then (url) =>
                            width = @mediaWidth(attrValue)
                            url = @sizedMediaURL(url, width) if width
                            e.setAttribute(tag.attr, url)
                        .catch () =>
                            console.warn('attachment ref not found', attrValue)

                        promises.push(promise)

        Promise.all(promises).then ->
            return el.innerHTML

angular.module("taigaComponents")
    .service("tgWysiwygService", WysiwygService)
