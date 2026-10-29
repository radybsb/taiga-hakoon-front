# Keep hover navigation on desktop and expose the same menus to touch/keyboard.
NavigationDropdown = ($document, $timeout) ->
    link: (scope, el, attrs) ->
        namespace = '.navigationDropdown' + scope.$id
        trigger = attrs.tgNavigationDropdown
        pinned = false
        pendingClose = null
        cancelClose = ->
            $timeout.cancel(pendingClose) if pendingClose
            pendingClose = null
        setOpen = (open) ->
            cancelClose()
            pinned = false unless open
            el.toggleClass('navigation-menu-open', open)
            el.find(trigger).attr('aria-expanded', String(open))
        el.on 'click' + namespace, trigger, (event) ->
            event.preventDefault()
            event.stopPropagation()
            pinned = true
            setOpen(true)
        el.on 'mouseenter' + namespace, -> setOpen(true)
        el.on 'mouseleave' + namespace, ->
            return if pinned
            cancelClose()
            pendingClose = $timeout((-> setOpen(false)), 300, false)
        $document.on 'click' + namespace, (event) -> setOpen(false) unless el[0].contains(event.target)
        $document.on 'keydown' + namespace, (event) ->
            if event.key == 'Escape' && el.hasClass('navigation-menu-open')
                setOpen(false)
                el.find(trigger).filter(':visible').first().focus()
        removeRoute = scope.$on('$routeChangeStart', -> setOpen(false))
        scope.$on '$destroy', ->
            cancelClose()
            el.off(namespace)
            $document.off(namespace)
            removeRoute()

angular.module('taigaNavigationBar').directive('tgNavigationDropdown', ['$document', '$timeout', NavigationDropdown])
