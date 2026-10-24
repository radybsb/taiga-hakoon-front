# Permanent anchors belong to saved headings; editor content is left untouched.
WikiOutline = ($location, $window, $confirm) ->
    link: (scope, el) ->
        frame = null
        timer = null
        lastTarget = null
        lastEmitted = null
        highlighted = null
        navigate = ->
            return if scope.wikiPopupContext && !scope.wikiPopupContext.ready
            id = if scope.wikiPopupContext then scope.wikiPopupContext.chapter else $location.hash()
            if id != lastEmitted
                lastEmitted = id
                scope.$evalAsync -> scope.$emit('wiki:chapter:active', id) unless scope.wikiPopupContext
            return unless id && id != lastTarget && !scope.descriptionState?.editing
            target = Array.from(el[0].querySelectorAll('[data-wiki-chapter]')).find((node) -> node.id == id)
            return unless target
            lastTarget = id
            target.tabIndex = -1
            target.focus({preventScroll: true})
            reduced = $window.matchMedia('(prefers-reduced-motion: reduce)').matches
            target.scrollIntoView({block: 'start', behavior: if reduced then 'auto' else 'smooth'})
            highlighted?.classList.remove('wiki-chapter-target')
            highlighted = target
            target.classList.add('wiki-chapter-target')
            $window.clearTimeout(timer)
            timer = $window.setTimeout((-> target.classList.remove('wiki-chapter-target')), 2000)
        update = ->
            frame = null
            return if scope.descriptionState?.editing
            content = el[0].querySelector('.js-wysiwyg-html') || el[0].querySelector('.wysiwyg')
            return unless content
            headings = content.querySelectorAll('h1, h2, h3')
            outline = scope.item?.outline || []
            for chapter, index in outline
                heading = headings[index]
                continue unless heading
                heading.id = chapter.id
                heading.setAttribute('data-wiki-chapter', '')
                continue if heading.querySelector('.wiki-copy-chapter-link')
                button = document.createElement('button')
                button.type = 'button'
                button.className = 'wiki-copy-chapter-link'
                button.textContent = '#'
                button.title = 'Copy chapter link'
                button.setAttribute('aria-label', 'Copy link to ' + chapter.title)
                do (chapter) ->
                    button.addEventListener 'click', (event) ->
                        event.preventDefault()
                        event.stopPropagation()
                        path = scope.wikiPopupContext?.path || $window.location.pathname
                        url = $window.location.origin + path + '#' + chapter.id
                        if !$window.navigator.clipboard?.writeText
                            scope.$applyAsync -> $confirm.notify('light-error', 'Your browser cannot copy this link. Open the chapter from the index and copy its address.')
                            return
                        $window.navigator.clipboard.writeText(url).then ->
                            scope.$applyAsync -> $confirm.notify('success', 'Chapter link copied.')
                        .catch -> scope.$applyAsync -> $confirm.notify('light-error', 'The chapter link could not be copied.')
                heading.appendChild(button)
            navigate()
        schedule = ->
            frame = $window.requestAnimationFrame(update) unless frame
        observer = new MutationObserver(schedule)
        observer.observe(el[0], {childList: true, subtree: true})
        scope.$watch('item.outline', schedule, true)
        scope.$watch('descriptionState.editing', (editing) ->
            lastTarget = null
            schedule() unless editing
        )
        scope.$on('wiki:chapter:navigate', (event, path) ->
            ownPath = (scope.wikiPopupContext?.path || $window.location.pathname).replace(/\/$/, '').replace(/\/wiki$/, '/wiki/home')
            return unless ownPath == path
            lastTarget = null
            schedule()
        )
        scope.$watchGroup(['wikiPopupContext.chapter', 'wikiPopupContext.ready'], ->
            lastTarget = null
            schedule()
        )
        scope.$on('$locationChangeSuccess', ->
            lastTarget = null
            schedule()
        )
        scope.$on '$destroy', ->
            observer.disconnect()
            $window.cancelAnimationFrame(frame) if frame
            $window.clearTimeout(timer)
        schedule()

angular.module('taigaWiki').directive('tgWikiOutline', ['$location', '$window', '$tgConfirm', WikiOutline])
