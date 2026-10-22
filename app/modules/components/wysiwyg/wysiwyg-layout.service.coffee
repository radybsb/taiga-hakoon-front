###
# This source code is licensed under the GNU Affero General Public License.
###

class WysiwygLayoutService
    @.$inject = ['$translate']
    constructor: (@translate) ->

    # Preserve layout in each HTML/Markdown converter, including mode switches.
    # Markdown has no native row/alignment syntax.
    preserveConversion: (conversion) ->
        return if conversion._taigaLayout
        conversion._taigaLayout = true
        toMarkdown = conversion.toMarkdown.bind(conversion)
        conversion.toMarkdown = (html) ->
            root = document.createElement('div')
            root.innerHTML = html || ''
            blocks = []
            selector = '.taiga-media-row, .taiga-align-left, .taiga-align-center, .taiga-align-right'
            root.querySelectorAll(selector).forEach (block) ->
                return unless root.contains(block)
                return if block.parentElement.closest(selector)
                token = 'TAIGALAYOUTBLOCK' + Date.now() + blocks.length
                token += 'X' while root.textContent.indexOf(token) != -1
                blocks.push({token: token, html: block.outerHTML})
                placeholder = document.createElement('p')
                placeholder.textContent = token
                block.replaceWith(placeholder)
            markdown = toMarkdown(root.innerHTML)
            blocks.forEach (block) -> markdown = markdown.replace(block.token, -> block.html)
            return markdown

    enable: (editor) ->
        return if editor._taigaLayout
        editor._taigaLayout = true
        schema = editor.model.schema
        schema.register 'taigaMediaRow', {
            isBlock: true
            allowWhere: '$block'
            allowChildren: ['image', 'taigaInlineVideo']
            allowAttributes: ['taigaAlignment', 'taigaGap']
        }
        schema.extend('image', {allowIn: 'taigaMediaRow'})
        schema.extend('taigaInlineVideo', {allowIn: 'taigaMediaRow'})
        schema.extend('$block', {allowAttributes: 'taigaAlignment'})
        editor.conversion.elementToElement {
            model: 'taigaMediaRow'
            view: {name: 'div', classes: 'taiga-media-row'}
        }
        alignViews = {}
        for value in ['left', 'center', 'right']
            alignViews[value] = {key: 'class', value: 'taiga-align-' + value}
        editor.conversion.attributeToAttribute {
            model: {key: 'taigaAlignment', values: ['left', 'center', 'right']}
            view: alignViews
        }
        gapViews = {}
        for value in ['0', '8', '16', '24', '32', '40', '48', '56', '64', '72']
            gapViews[value] = {key: 'class', value: 'taiga-gap-' + value}
        editor.conversion.attributeToAttribute {
            model: {name: 'taigaMediaRow', key: 'taigaGap', values: ['0', '8', '16', '24', '32', '40', '48', '56', '64', '72']}
            view: gapViews
        }
        editor.model.document.registerPostFixer (writer) ->
            for rootName in editor.model.document.getRootNames()
                for entry in Array.from(editor.model.createRangeIn(editor.model.document.getRoot(rootName)).getWalker())
                    node = entry.item
                    if node.is('element', 'taigaMediaRow') && !node.childCount
                        writer.remove(node)
                        return true
            return false

        editable = editor.ui.getEditableElement()
        # tg-text-editor has its own Angular converter, distinct from the one
        # exposed to Taiga through angularDataConversion().
        strategy = editable.closest('tg-text-editor')?.ngElementStrategy
        component = (strategy?.componentRef || strategy?.strategy?.componentRef)?.instance
        @preserveConversion(component.dataConversionService) if component?.dataConversionService
        label = (key) => @translate?.instant('COMMON.WYSIWYG.LAYOUT.' + key) || key
        selectedMedia = null
        mediaOf = ->
            selected = editor.model.document.selection.getSelectedElement()
            return selected if selected?.name in ['image', 'taigaInlineVideo']
            return selectedMedia if selectedMedia?.root == editor.model.document.getRoot()
        blockOf = (media) ->
            return media.parent if media.parent.is('element', 'taigaMediaRow')
            if media.is('element', 'taigaInlineVideo') && media.parent.is('element', 'paragraph')
                return media.parent
            return media
        mediaIn = (block) ->
            return [] unless block
            return Array.from(block.getChildren()) if block.is('element', 'taigaMediaRow')
            return [block] if block.name in ['image', 'taigaInlineVideo']
            if block.is('element', 'paragraph')
                content = Array.from(block.getChildren()).filter((child) ->
                    !child.is('$text') || !/^\s*$/.test(child.data)
                )
                return content if content.length && content.every((child) -> child.is('element', 'taigaInlineVideo'))
            return []
        whitespaceOnly = (block) ->
            block?.is('element', 'paragraph') && Array.from(block.getChildren()).every((child) ->
                child.is('$text') && /^\s*$/.test(child.data)
            )
        previousInlineVideo = (media) ->
            return unless media?.parent.is('element', 'paragraph')
            previous = media.previousSibling
            previous = previous.previousSibling while previous?.is('$text') && /^\s*$/.test(previous.data)
            return previous if previous?.is('element', 'taigaInlineVideo')
        startsParagraph = (media) ->
            media?.parent.is('element', 'paragraph') && Array.from(media.parent.getChildren()).slice(0, media.index).every((child) ->
                child.is('$text') && /^\s*$/.test(child.data)
            )
        makeRow = (writer, block, media = null) ->
            return block if block.is('element', 'taigaMediaRow')
            children = mediaIn(block)
            return unless schema.checkChild(block.parent, 'taigaMediaRow')
            # Extract an inline video without discarding surrounding description text.
            if !children.length && media?.parent == block && block.is('element', 'paragraph')
                position = writer.split(writer.createPositionBefore(media)).position
                tail = position.nodeAfter
                row = writer.createElement('taigaMediaRow', {taigaGap: '16'})
                writer.insert(row, position)
                writer.move(writer.createRangeOn(media), writer.createPositionAt(row, 'end'))
                writer.remove(block) if whitespaceOnly(block)
                writer.remove(tail) if whitespaceOnly(tail)
                writer.setSelection(media, 'on')
                return row
            return unless children.length
            attributes = {taigaGap: '16'}
            attributes.taigaAlignment = block.getAttribute('taigaAlignment') if block.hasAttribute('taigaAlignment')
            row = writer.createElement('taigaMediaRow', attributes)
            writer.insert(row, writer.createPositionBefore(block))
            for child in children
                writer.move(writer.createRangeOn(child), writer.createPositionAt(row, 'end'))
            writer.remove(block) if block.is('element', 'paragraph')
            return row
        join = ->
            media = mediaOf()
            return unless media
            editor.model.change (writer) ->
                block = blockOf(media)
                inlinePrevious = previousInlineVideo(media)
                if inlinePrevious
                    row = makeRow(writer, inlinePrevious.parent, inlinePrevious)
                    return unless row
                    if media.parent != row
                        oldParent = media.parent
                        writer.move(writer.createRangeOn(media), writer.createPositionAt(row, 'end'))
                        writer.remove(oldParent) if whitespaceOnly(oldParent)
                    writer.setSelection(media, 'on')
                    return
                previous = block.previousSibling
                children = mediaIn(block)
                children = [media] if !children.length && startsParagraph(media)
                return unless mediaIn(previous).length && children.length
                row = makeRow(writer, previous)
                return unless row
                for child in children
                    writer.move(writer.createRangeOn(child), writer.createPositionAt(row, 'end'))
                writer.remove(block) if block.is('element', 'taigaMediaRow') || whitespaceOnly(block)
                writer.setSelection(media, 'on')
        newLine = ->
            media = mediaOf()
            return unless media?.parent.is('element', 'taigaMediaRow')
            editor.model.change (writer) ->
                row = media.parent
                after = Array.from(row.getChildren()).slice(media.index + 1)
                if after.length
                    next = writer.createElement('taigaMediaRow', row.getAttributes())
                    writer.insert(next, writer.createPositionAfter(row))
                    for child in after
                        writer.move(writer.createRangeOn(child), writer.createPositionAt(next, 'end'))
                    writer.setSelection(after[0], 'on')
                else
                    paragraph = writer.createElement('paragraph')
                    writer.insert(paragraph, writer.createPositionAfter(row))
                    writer.setSelection(paragraph, 0)
        align = (value) ->
            editor.model.change (writer) ->
                media = mediaOf()
                if media
                    block = blockOf(media)
                    row = makeRow(writer, block, media)
                    target = row || block
                    writer.removeAttribute('alignment', target) if target.hasAttribute('alignment')
                    writer.setAttribute('taigaAlignment', value, target)
                else
                    for block in Array.from(editor.model.document.selection.getSelectedBlocks())
                        if schema.checkAttribute(block, 'taigaAlignment')
                            writer.removeAttribute('alignment', block) if block.hasAttribute('alignment')
                            writer.setAttribute('taigaAlignment', value, block)
        editor._taigaLayoutActions = {join: join, newLine: newLine, align: align}
        # Use CKEditor's own views so these controls participate in toolbar
        # overflow, focus handling, tooltips and keyboard navigation.
        factory = editor.ui.componentFactory
        seedButton = factory.create('bold')
        ButtonView = seedButton.constructor
        seedButton.destroy()
        seedDropdown = factory.create('heading')
        DropdownView = seedDropdown.constructor
        DropdownButtonView = seedDropdown.buttonView.constructor
        PanelView = seedDropdown.panelView.constructor
        ToolbarView = editor.ui.view.toolbar.constructor
        seedDropdown.destroy()
        icons = {
            left: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2 3h16v2H2zm0 4h10v2H2zm0 4h16v2H2zm0 4h10v2H2z"/></svg>'
            center: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2 3h16v2H2zm3 4h10v2H5zm-3 4h16v2H2zm3 4h10v2H5z"/></svg>'
            right: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2 3h16v2H2zm6 4h10v2H8zm-6 4h16v2H2zm6 4h10v2H8z"/></svg>'
            join: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M1 5h6v10H1zm12 0h6v10h-6zM8 9h4v2H8zm0-2 3 3-3 3z"/></svg>'
            gap: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M1 4h3v12H1zm15 0h3v12h-3zM5 9h10v2H5zm0 1 3-3v6zm10 0-3-3v6z"/></svg>'
        }
        views = []
        outsideListeners = []
        createButton = (text, icon, action) ->
            view = new ButtonView(editor.locale)
            view.set({label: text, icon: icon, tooltip: true})
            view.on 'execute', -> action() unless editor.isReadOnly
            return view
        createDropdown = (text, icon) ->
            buttonView = new DropdownButtonView(editor.locale)
            panel = new PanelView(editor.locale)
            dropdown = new DropdownView(editor.locale, buttonView, panel)
            buttonView.set({label: text, icon: icon, tooltip: true})
            buttonView.bind('isEnabled').to(dropdown)
            buttonView.bind('isOn').to(dropdown, 'isOpen')
            inner = new ToolbarView(editor.locale)
            inner.isVertical = true
            inner.ariaLabel = text
            panel.children.add(inner)
            dropdown.toolbarView = inner
            dropdown.keystrokes.set 'arrowdown', (data, cancel) ->
                if dropdown.isOpen
                    panel.focus()
                    cancel()
            dropdown.keystrokes.set 'arrowup', (data, cancel) ->
                if dropdown.isOpen
                    panel.focusLast()
                    cancel()
            outside = (event) ->
                dropdown.isOpen = false unless dropdown.element?.contains(event.target)
            document.addEventListener('mousedown', outside)
            outsideListeners.push(outside)
            return dropdown
        toolbar = editor.ui.view.toolbar
        headingDropdown = Array.from(toolbar.items).find((view) -> view.element?.classList.contains('ck-heading-dropdown'))
        if headingDropdown
            headingDropdown.buttonView.unbind('label')
            headingDropdown.buttonView.set({label: 'Tt', tooltip: editor.t('Choose heading')})

        listButtons = []
        for name in ['todoList', 'bulletedList', 'numberedList']
            continue unless factory.has(name)
            seed = factory.create(name)
            item = Array.from(toolbar.items).find((view) -> view.label == seed.label)
            if item
                listButtons.push({view: item, index: toolbar.items.getIndex(item), name: name})
            seed.destroy()
        if listButtons.length
            bullet = listButtons.find((item) -> item.name == 'bulletedList') || listButtons[0]
            listDropdown = createDropdown(editor.t('Bulleted List'), bullet.view.icon)
            listIndex = Math.min.apply(null, listButtons.map((item) -> item.index))
            for entry in listButtons
                toolbar.items.remove(entry.view)
                entry.view.set('withText', true)
                listDropdown.toolbarView.items.add(entry.view)
                entry.view.on 'execute', ->
                    listDropdown.isOpen = false
                    editor.editing.view.focus()
            listDropdown.bind('isEnabled').toMany(listButtons.map((entry) -> entry.view), 'isEnabled', (values...) -> values.some(Boolean))
            toolbar.items.add(listDropdown, listIndex)
            views.push(listDropdown)

        alignmentButtons = []
        nativeAlignment = editor.commands.get('alignment')
        alignmentDropdown = Array.from(editor.ui.view.toolbar.items).find((view) ->
            view.buttonView?.label == editor.t('Text alignment') || view.element?.classList.contains('ck-alignment-dropdown')
        )
        nativeRefresh = nativeAlignment?.refresh
        nativeExecute = null
        if nativeAlignment
            # Intercept the existing command instead of maintaining two competing
            # alignment systems (inline styles versus persistent layout classes).
            nativeExecute = (event, args) ->
                event.stop()
                return if editor.isReadOnly
                align(args[0]?.value || 'left')
                editor.editing.view.forceRender()
            nativeAlignment.on('execute', nativeExecute, {priority: 'highest'})
            nativeAlignment.refresh = ->
                media = mediaOf()
                block = if media then blockOf(media) else Array.from(editor.model.document.selection.getSelectedBlocks())[0]
                @isEnabled = !editor.isReadOnly && !!block
                @value = block?.getAttribute('taigaAlignment') || block?.getAttribute('alignment') || 'left'
        if !alignmentDropdown
            alignmentDropdown = createDropdown(editor.t('Text alignment'), icons.left)
            editor.ui.view.toolbar.items.add(alignmentDropdown)
            views.push(alignmentDropdown)
        if nativeAlignment
            center = createButton(editor.t('Align center'), icons.center, -> editor.execute('alignment', {value: 'center'}))
            center.set('isToggleable', true)
            center.bind('isEnabled').to(nativeAlignment)
            center.bind('isOn').to(nativeAlignment, 'value', (value) -> value == 'center')
            unless Array.from(alignmentDropdown.toolbarView.items).some((view) -> view.label == editor.t('Align center'))
                alignmentDropdown.toolbarView.items.add(center, Math.min(1, alignmentDropdown.toolbarView.items.length))
                alignmentButtons.push(center)
            else
                center.destroy()
            # Some builds instantiate the native dropdown lazily (overflow).
            unless alignmentDropdown.toolbarView.items.length >= 3
                for value in ['left', 'right']
                    do (value) ->
                        item = createButton(editor.t('Align ' + value), icons[value], -> editor.execute('alignment', {value: value}))
                        item.bind('isEnabled').to(nativeAlignment)
                        item.bind('isOn').to(nativeAlignment, 'value', (current) -> current == value)
                        index = if value == 'left' then 0 else alignmentDropdown.toolbarView.items.length
                        alignmentDropdown.toolbarView.items.add(item, index)
                        alignmentButtons.push(item)
            alignmentDropdown.buttonView.unbind('icon')
            alignmentDropdown.buttonView.bind('icon').to(nativeAlignment, 'value', (value) -> icons[value] || icons.left)
        else
            for value in ['left', 'center', 'right']
                do (value) ->
                    item = createButton(editor.t('Align ' + value), icons[value], ->
                        align(value)
                        alignmentDropdown.isOpen = false
                    )
                    item.set('isToggleable', true)
                    alignmentDropdown.toolbarView.items.add(item)
                    alignmentButtons.push(item)
        joinButton = createButton(label('SAME_ROW'), icons.join, join)
        removeFormat = if factory.has('removeFormat') then factory.create('removeFormat') else null
        removeButton = Array.from(toolbar.items).find((view) -> view.label == removeFormat?.label)
        removeFormat?.destroy()
        mediaIndex = if removeButton then toolbar.items.getIndex(removeButton) else toolbar.items.length
        toolbar.items.add(joinButton, mediaIndex)
        views.push(joinButton)
        gapDropdown = createDropdown(label('GAP'), icons.gap)
        gapButtons = []
        for value in ['0', '8', '16', '24', '32', '40', '48', '56', '64', '72']
            do (value) ->
                item = createButton(value + ' px', null, ->
                    media = mediaOf()
                    return unless media
                    editor.model.change (writer) ->
                        row = makeRow(writer, blockOf(media), media)
                        writer.setAttribute('taigaGap', value, row) if row
                    gapDropdown.isOpen = false
                )
                item.set({withText: true, isToggleable: true})
                item._taigaGap = value
                gapDropdown.toolbarView.items.add(item)
                gapButtons.push(item)
        toolbar.items.add(gapDropdown, mediaIndex + 1)
        views.push(gapDropdown)
        update = ->
            media = mediaOf()
            block = blockOf(media) if media
            canJoin = !!previousInlineVideo(media) || ((mediaIn(block).length || startsParagraph(media)) && !!mediaIn(block?.previousSibling).length)
            joinButton.isEnabled = !editor.isReadOnly && !!media && !!canJoin
            currentBlock = block || Array.from(editor.model.document.selection.getSelectedBlocks())[0]
            currentAlignment = currentBlock?.getAttribute('taigaAlignment') || currentBlock?.getAttribute('alignment') || 'left'
            if nativeAlignment
                nativeAlignment.refresh()
            else
                alignmentDropdown.isEnabled = !editor.isReadOnly && !!currentBlock
                alignmentDropdown.buttonView.icon = icons[currentAlignment] || icons.left
                for item, index in alignmentButtons
                    item.isEnabled = alignmentDropdown.isEnabled
                    item.isOn = ['left', 'center', 'right'][index] == currentAlignment
            gapDropdown.isEnabled = !editor.isReadOnly && !!media && schema.checkChild(block.parent, 'taigaMediaRow')
            currentGap = if media?.parent.is('element', 'taigaMediaRow') then media.parent.getAttribute('taigaGap') || '16' else '16'
            for item in gapButtons
                item.isEnabled = gapDropdown.isEnabled
                item.isOn = item._taigaGap == currentGap
        editor._taigaLayoutViews = {alignment: alignmentDropdown, join: joinButton, gap: gapDropdown}
        select = (event) ->
            dom = event.target.closest('img, video')?.closest('.ck-widget')
            return unless dom
            view = editor.editing.view.domConverter.mapDomToView(dom)
            media = editor.editing.mapper.toModelElement(view) if view
            return unless media?.name in ['image', 'taigaInlineVideo']
            unless editor.isReadOnly
                editor.model.change (writer) -> writer.setSelection(media, 'on')
            selectedMedia = media
            update()
        selectionChanged = ->
            # Range changes can fire inside remove/move/post-fixer operations.
            # Read selection-dependent positions only after the model commits.
            selectedMedia = null
        editable.addEventListener('click', select)
        editor.model.document.selection.on('change:range', selectionChanged)
        editor.model.document.on('change', update)
        editor.on('change:isReadOnly', update)
        editor.keystrokes.set 'Enter', (data, cancel) ->
            if !editor.isReadOnly && mediaOf()?.parent.is('element', 'taigaMediaRow')
                newLine()
                cancel()
        editor.setData(editor.getData())
        update()
        editor.once 'destroy', ->
            editable.removeEventListener('click', select)
            editor.model.document.selection.off('change:range', selectionChanged)
            editor.model.document.off('change', update)
            editor.off('change:isReadOnly', update)
            for outside in outsideListeners
                document.removeEventListener('mousedown', outside)
            if nativeAlignment
                nativeAlignment.off('execute', nativeExecute)
                nativeAlignment.refresh = nativeRefresh
            for view in views
                editor.ui.view.toolbar.items.remove(view)
                view.destroy()

angular.module('taigaComponents').service('tgWysiwygLayoutService', WysiwygLayoutService)
