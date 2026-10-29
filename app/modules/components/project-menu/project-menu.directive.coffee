###
# This source code is licensed under the GNU Affero General Public License.
###

ProjectNavigationState = ($rootScope, $document, $window) ->
    state = {open: false}
    state.close = (restoreFocus = false) ->
        state.open = false
        $document[0].body.classList.remove('project-navigation-open')
        $document[0].querySelector('.project-navigation-toggle')?.focus() if restoreFocus
    state.toggle = ->
        if state.open then state.close() else
            state.open = true
            $document[0].body.classList.add('project-navigation-open')
    close = -> state.close()
    removeRoute = $rootScope.$on('$routeChangeStart', close)
    removeLightbox = $rootScope.$on('lightbox:opened', close)
    $document.on 'keydown.projectNavigation', (event) ->
        return unless state.open
        if event.key == 'Escape' || event.keyCode == 27
            event.preventDefault()
            $rootScope.$evalAsync -> state.close(true)
        else if event.key == 'Tab'
            host = $document[0].querySelector('tg-project-menu tg-legacy-loader')
            root = host?.shadowRoot
            closeButton = $document[0].querySelector('.project-navigation-drawer-header button')
            links = Array.from(root?.querySelectorAll('a[href], button:not([disabled])') || []).filter((node) -> node.getClientRects().length)
            controls = [closeButton].concat(links).filter(Boolean)
            active = root?.activeElement || $document[0].activeElement
            if controls.length && (!controls.includes(active) || (!event.shiftKey && active == controls[controls.length - 1]) || (event.shiftKey && active == controls[0]))
                event.preventDefault()
                controls[if event.shiftKey then controls.length - 1 else 0].focus()

    desktop = $window.matchMedia('(min-width: 1200px)')
    resize = -> $rootScope.$evalAsync(close) if desktop.matches
    if desktop.addEventListener then desktop.addEventListener('change', resize) else desktop.addListener(resize)
    $rootScope.$on '$destroy', ->
        $document.off('.projectNavigation')
        if desktop.removeEventListener then desktop.removeEventListener('change', resize) else desktop.removeListener(resize)
        removeRoute()
        removeLightbox()
    state

ProjectMenuDirective = (projectService, lightboxFactory, navigation, $window) ->
    link = (scope, el, attrs, ctrl) ->
        scope.navigation = navigation
        scope.$watch((-> projectService.project), ->
            navigation.close()
            if projectService.project then ctrl.show() else ctrl.hide()
        )
        scope.$watch('navigation.open', (open) -> el.toggleClass('navigation-drawer-open', !!open))
        installAppearance = ->
            host = el[0].querySelector('tg-legacy-loader')
            root = host?.shadowRoot
            return unless root
            return if root.querySelector('style[data-workspace-navigation]')
            style = document.createElement('style')
            style.setAttribute('data-workspace-navigation', '')
            style.textContent = """
                :host { --color-black800: var(--workspace-surface); --color-black900: var(--workspace-soft); --color-gray400: var(--workspace-muted); --color-white: var(--workspace-text); --color-solid-primary: var(--workspace-accent); --color-link-primary: var(--workspace-accent); }
                .nav-inner { width: 200px; }
                h1 { background: transparent !important; padding: 18px 12px !important; border-bottom: 1px solid var(--workspace-border); margin-bottom: 10px !important; }
                h1 .project-link { color: var(--workspace-text) !important; font-weight: 600; font-size: 14px !important; gap: 2px; }
                h1 img { border-radius: 7px !important; }
                img[src*="/images/project-logos/"], img[src*="/images/user-avatars/"] { background: transparent !important; outline: 1px solid var(--workspace-border); outline-offset: -1px; }
                .main-menu { padding: 0 8px 8px !important; }
                .menu-option { margin-bottom: 4px !important; }
                .menu-option > a, .menu-option > button { border-radius: 8px; font-size: 14px !important; height: 40px; }
                .menu-option.active > a, .menu-option.active > button, .menu-option.active-dialog > a { background: var(--workspace-accent-soft) !important; color: var(--workspace-accent) !important; }
                .menu-option.active > a > svg, .menu-option.active > button > svg { fill: var(--workspace-accent) !important; }
                .menu-option > a:hover, .menu-option > button:hover { background: var(--workspace-hover) !important; color: var(--workspace-text) !important; }
                .main-menu svg { height: 20px !important; width: 20px !important; }
                .child-menu { background: transparent !important; padding-top: 4px !important; }
                .child-menu a.active { background: var(--workspace-accent-soft); border-radius: 7px; color: var(--workspace-accent) !important; }
                .menu-secondary { border-color: var(--workspace-border) !important; padding-top: 10px !important; }
                .collapse { color: var(--workspace-muted) !important; font-size: 12px !important; }
                .dialog { background: var(--workspace-surface) !important; border: 1px solid var(--workspace-border); border-radius: 10px; box-shadow: var(--workspace-popup-shadow); }
                a:focus-visible, button:focus-visible { outline: 2px solid var(--workspace-accent); outline-offset: -2px; }
                @media (max-width: 1199px) {
                    tg-project-navigation { width: 64px !important; }
                    .nav-wrapper { background: var(--workspace-surface); width: 64px !important; overflow-x: hidden; height: 100% !important; }
                    .nav-inner { width: 264px !important; }
                    .main-menu { padding: 0 8px 8px !important; }
                    .menu-option > a, .menu-option > button { min-height: 44px; height: auto; }
                    .menu-option-text, .collapse { display: none !important; }
                    :host-context(.mobile-menu-open) tg-project-navigation,
                    :host-context(.mobile-menu-open) .nav-wrapper { width: 264px !important; }
                    :host-context(.mobile-menu-open) .menu-option-text { display: inline !important; opacity: 1 !important; transform: none !important; }

                    :host-context(.mobile-menu-open) .nav-wrapper { box-shadow: var(--workspace-popup-shadow); }
                }
            """
            root.appendChild(style)
        onScroll = ->
            height = document.querySelector('.navbar')?.offsetHeight || 48
            el.find('.sticky-project-menu').toggleClass('unblock', $window.scrollY >= height)
        $window.addEventListener('scroll', onScroll, {passive: true})
        observer = new MutationObserver(installAppearance)
        observer.observe(el[0], {childList: true, subtree: true})
        installAppearance()
        # Follow link clicks through the navigation's shadow root.
        onLink = (event) ->
            if !navigation.open && $window.matchMedia('(max-width: 1199px)').matches && event.composedPath().some((node) -> node.classList?.contains('scrum'))
                scope.$evalAsync -> navigation.toggle()
            if event.composedPath().some((node) -> node.tagName == 'A' && node.getAttribute('href'))
                scope.$evalAsync -> navigation.close()
        el[0].addEventListener('click', onLink)
        scope.$on '$destroy', ->
            observer.disconnect()
            $window.removeEventListener('scroll', onScroll)
            el[0].removeEventListener('click', onLink)
            navigation.close()
    return {
        scope: {},
        controller: "ProjectMenu",
        controllerAs: "vm",
        templateUrl: "components/project-menu/project-menu.html",
        link: link
    }

ProjectMenuDirective.$inject = ['tgProjectService', 'tgLightboxFactory', 'tgProjectNavigationState', '$window']
angular.module('taigaComponents')
    .factory('tgProjectNavigationState', ['$rootScope', '$document', '$window', ProjectNavigationState])
    .directive('tgProjectMenu', ProjectMenuDirective)
