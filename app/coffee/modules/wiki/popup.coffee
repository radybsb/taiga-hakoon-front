# Open saved Wiki chapter links without navigating away from the current page.
class WikiPopupService
    @.$inject = ['tgProjectService', 'tgProjectsService', '$tgResources', 'tgLightboxFactory', 'lightboxService', '$document', '$q', '$tgConfirm']
    constructor: (@projectService, @projects, @resources, @factory, @lightbox, @document, @q, @confirm) ->
        @generation = 0

    open: (target) ->
        generation = ++@generation
        current = @projectService.project
        project = if current?.get('slug') == target.project then @q.when(current) else @projects.getProjectBySlug(target.project)
        project.then (project) =>
            throw new Error('Wiki access denied') unless project.get('is_wiki_activated') && project.get('my_permissions').includes('view_wiki_pages')
            @resources.wiki.getBySlug(project.get('id'), target.slug).then (page) =>
                return unless generation == @generation
                for node in @document.find('.lightbox-wiki-detail.open:not(.close-started)').get().reverse()
                    @lightbox.close($(node))
                @factory.create('tg-wiki-popup', {'class': 'lightbox lightbox-wiki-detail'}, {
                    wiki: page, popupProject: project,
                    wikiPopupContext: {chapter: target.chapter, path: target.path, ready: false}
                })
        .catch => @confirm.notify('error') if generation == @generation

WikiPopupDirective = (lightbox, projectService, attachments, $rootScope) ->
    link: (scope, el) ->
        el.data('scope', scope)
        scope.project = scope.popupProject.toJS()
        scope.projectId = scope.project.id
        previousProject = projectService._project
        previousMembers = projectService._activeMembers
        projectService._project = scope.popupProject
        projectService._activeMembers = scope.popupProject.get('members').filter((member) -> member.get('is_active'))
        previousAttachments = {}
        for key in ['_attachments', '_deprecatedsCount', '_attachmentsVisible', '_deprecatedsVisible', 'uploadingAttachments', '_attachmentContext']
            previousAttachments[key] = attachments[key]
        el[0].setAttribute('data-wiki-page-url', window.location.origin + scope.wikiPopupContext.path)
        el.on 'transitionend.wikiChapter', (event) ->
            return unless event.target == el[0]
            el.off('.wikiChapter')
            scope.$evalAsync -> scope.$broadcast('wiki:chapter:navigate', scope.wikiPopupContext.path) unless scope.$$destroyed
        scope.$on '$destroy', ->
            el.off('.wikiChapter')
            if projectService._project == scope.popupProject
                projectService._project = previousProject
                projectService._activeMembers = previousMembers
            attachments.invalidatePendingLoads?()
            for key, value of previousAttachments
                attachments[key] = value
            $rootScope.$broadcast('wiki:popup:closed', scope.wiki)
        lightbox.open(el).then ->
            return if scope.$$destroyed
            scope.wikiPopupContext.ready = true
            scope.$broadcast('wiki:chapter:navigate', scope.wikiPopupContext.path)
    templateUrl: 'wiki/wiki-popup.html'

WikiPopupDirective.$inject = ['lightboxService', 'tgProjectService', 'tgAttachmentsFullService', '$rootScope']

# Capture before rich-text links can call window.open. Modified clicks retain
# native new-tab behavior; external links and editing controls are untouched.
WikiChapterLinks = ($document, $window, $rootScope, $location, popup) ->
    listener = (event) ->
        return if event.button != 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.defaultPrevented
        anchor = event.target.closest?('a[href]')
        return unless anchor
        return if anchor.closest('[contenteditable="true"], .ck-editor__editable, .ck-balloon-panel')
        modal = anchor.closest('.lightbox-wiki-detail')
        try
            base = modal?.getAttribute('data-wiki-page-url') || $window.location.href
            href = anchor.getAttribute('href')
            url = if href.startsWith('#') then new URL(href, base) else new URL(anchor.href)
            return unless url.origin == $window.location.origin && /^#wiki-[\w-]+$/.test(url.hash)
            match = url.pathname.match(/^\/project\/([^/]+)\/wiki(?:\/([^/]+))?\/?$/)
            return unless match
            project = decodeURIComponent(match[1])
            slug = decodeURIComponent(match[2] || 'home')
            chapter = decodeURIComponent(url.hash.slice(1))
        catch
            return
        event.preventDefault()
        event.stopImmediatePropagation()
        path = '/project/' + encodeURIComponent(project) + '/wiki/' + encodeURIComponent(slug)
        currentPath = modal?.getAttribute('data-wiki-page-url') || $window.location.href
        current = new URL(currentPath).pathname.replace(/\/$/, '')
        current += '/home' if /\/wiki$/.test(current)
        $rootScope.$evalAsync ->
            if current == path
                if modal
                    angular.element(modal).data('scope').wikiPopupContext.chapter = chapter
                else
                    $location.hash(chapter)
                $rootScope.$broadcast('wiki:chapter:navigate', path)
            else
                popup.open({project: project, slug: slug, chapter: chapter, path: path})
    $document[0].addEventListener('click', listener, true)
    $rootScope.$on '$destroy', -> $document[0].removeEventListener('click', listener, true)

WikiChapterLinks.$inject = ['$document', '$window', '$rootScope', '$location', 'tgWikiPopup']
angular.module('taigaWiki').service('tgWikiPopup', WikiPopupService).directive('tgWikiPopup', WikiPopupDirective).run(WikiChapterLinks)
