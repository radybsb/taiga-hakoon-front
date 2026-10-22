###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

taiga = @.taiga

ProjectMenuDirective = (projectService, lightboxFactory) ->
    link = (scope, el, attrs, ctrl) ->
        projectChange = () ->
            if projectService.project
                ctrl.show()
            else
                ctrl.hide()

        scope.$watch ( () ->
            return projectService.project
        ), projectChange

        # The Angular navigation is hosted in a shadow root.
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
                @media (max-width: 650px) {
                    tg-project-navigation { width: 48px !important; z-index: 10; }
                    .nav-wrapper { background: var(--workspace-surface); width: 48px; }
                    :host-context(.mobile-menu-open) .nav-wrapper { box-shadow: var(--workspace-popup-shadow); width: 200px; }
                    .main-menu { padding-left: 0 !important; padding-right: 0 !important; }
                    .collapse { justify-content: flex-start !important; }
                }
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
            """
            root.appendChild(style)


        observer = new MutationObserver(installAppearance)
        observer.observe(el[0], {childList: true, subtree: true})
        installAppearance()
        scope.$on '$destroy', -> observer.disconnect()

        fixed = false
        topBarHeight = 48

        window.addEventListener "scroll", () ->
            position = $(window).scrollTop()

            if position > topBarHeight && fixed == false
                el.find('.sticky-project-menu').addClass('unblock')
                fixed = true
            else if position == 0 && fixed == true
                el.find('.sticky-project-menu').removeClass('unblock')
                # The Angular navigation is hosted in a shadow root.
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
                @media (max-width: 650px) {
                    tg-project-navigation { width: 48px !important; z-index: 10; }
                    .nav-wrapper { background: var(--workspace-surface); width: 48px; }
                    :host-context(.mobile-menu-open) .nav-wrapper { box-shadow: var(--workspace-popup-shadow); width: 200px; }
                    .main-menu { padding-left: 0 !important; padding-right: 0 !important; }
                    .collapse { justify-content: flex-start !important; }
                }
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
            """
            root.appendChild(style)


        observer = new MutationObserver(installAppearance)
        observer.observe(el[0], {childList: true, subtree: true})
        installAppearance()
        scope.$on '$destroy', -> observer.disconnect()

        fixed = false

    return {
        scope: {},
        controller: "ProjectMenu",
        controllerAs: "vm",
        templateUrl: "components/project-menu/project-menu.html",
        link: link
    }

ProjectMenuDirective.$inject = [
    "tgProjectService",
    "tgLightboxFactory"
]

angular.module("taigaComponents").directive("tgProjectMenu", ProjectMenuDirective)
