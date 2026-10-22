###
# Appearance preferences are independent of the existing Taiga theme stylesheet.
# The first rollout is scoped to the Kanban workspace and its lightboxes.
###

class WorkspaceAppearanceService
    @.$inject = ["$window", "$document", "$rootScope"]

    constructor: (@window, document, rootScope) ->
        @root = document[0].documentElement
        @key = "taiga.workspace.appearance"
        @media = @window.matchMedia?("(prefers-color-scheme: dark)")
        @preference = "system"
        try
            saved = @window.localStorage.getItem(@key)
            @preference = saved if saved in ["light", "dark", "system"]
        catch
            # Storage may be unavailable in private or restricted browsers.
            null
        @apply()
        changed = =>
            if @preference == "system"
                @apply()
                rootScope.$evalAsync()
        if @media?.addEventListener
            @media.addEventListener("change", changed)
        else
            @media?.addListener(changed)

    apply: ->
        dark = @preference == "dark" || (@preference == "system" && @media?.matches)
        @dark = !!dark
        @root.setAttribute("data-workspace-appearance", if dark then "dark" else "light")

    set: (preference) ->
        return unless preference in ["light", "dark", "system"]
        @preference = preference
        try
            @window.localStorage.setItem(@key, preference)
        catch
            null
        @apply()

angular.module("taigaComponents").service("tgWorkspaceAppearance", WorkspaceAppearanceService)

WorkspaceDirective = (appearance, document) ->
    restrict: "A"
    link: (scope, el, attrs) ->
        root = document[0].documentElement
        root.setAttribute("data-modern-workspace", if attrs.tgModernWorkspace in ["backlog", "taskboard", "issues", "epics", "timeline", "wiki", "settings", "team", "home", "projects", "search", "discover", "notifications", "user-settings", "detail", "auth", "error", "profile"] then attrs.tgModernWorkspace else "kanban")
        scope.$on "$destroy", -> root.removeAttribute("data-modern-workspace")

WorkspaceDirective.$inject = ["tgWorkspaceAppearance", "$document"]
angular.module("taigaComponents").directive("tgModernWorkspace", WorkspaceDirective)

AppearanceDirective = (appearance) ->
    restrict: "E"
    scope: {}
    templateUrl: "components/kanban-appearance/kanban-appearance.html"
    link: (scope) ->
        scope.appearance = appearance

AppearanceDirective.$inject = ["tgWorkspaceAppearance"]
angular.module("taigaComponents").directive("tgWorkspaceThemeToggle", AppearanceDirective)
