###
# This source code is licensed under the GNU Affero General Public License.
###

class DetailPopupService
    @.$inject = ['tgProjectService', 'tgProjectsService', 'tgLightboxFactory', '$q', '$tgConfirm', 'lightboxService', '$document']
    constructor: (@projectService, @projects, @factory, @q, @confirm, @lightboxService, @document) ->
        @pending = {}
        @generation = 0
    open: (route, options) ->
        type = {
            'project-userstories-detail': 'us'
            'project-tasks-detail': 'task'
            'project-issues-detail': 'issue'
            'project-epics-detail': 'epic'
        }[route]
        return unless type && options.project && options.ref
        key = type + ':' + options.project + ':' + options.ref
        return if @pending[key]
        @pending[key] = true
        generation = ++@generation
        current = @projectService.project
        project = if current?.get('slug') == options.project then @q.when(current) else @projects.getProjectBySlug(options.project)
        return project.then (project) =>
            return unless generation == @generation
            # Detail navigation replaces the current item; media previews retain
            # their own overlay behavior and close with the outgoing detail.
            for detail in @document.find('.lightbox-task-detail').get().reverse()
                for preview in $(detail).find('.lightbox.open').get().reverse()
                    @lightboxService.close($(preview))
                @lightboxService.close($(detail))
            @factory.create('tg-detail-popup', {'class': 'lightbox lightbox-task-detail', 'tg-detail-popup-refresh': true}, {
                popupType: type, popupRef: options.ref, popupProject: project
            })
        .catch(=> @confirm.notify('error') if generation == @generation).finally => delete @pending[key]

DetailPopupDirective = ($controller, $rs, $rootScope, $q, projectService, transform, attachments, lightboxService) ->
    link = (scope, el) ->
        return if scope.$$destroyed
        el.data('scope', scope)
        scope.detailPopup = true
        previousProject = projectService._project
        previousMembers = projectService._activeMembers
        projectService._project = scope.popupProject
        projectService._activeMembers = scope.popupProject.get('members').filter((member) -> member.get('is_active'))
        previousScope = transform.scope
        previousProp = transform.prop
        previousAttachments = {}
        for key in ['_attachments', '_deprecatedsCount', '_attachmentsVisible', '_deprecatedsVisible', 'uploadingAttachments', '_attachmentContext']
            previousAttachments[key] = attachments[key]
        localProject = Object.create(projectService)
        localProject._project = scope.popupProject
        Object.defineProperty(localProject, 'project', {get: -> scope.popupProject})
        localResources = Object.create($rs)
        resource = {us: 'userstories', issue: 'issues', epic: 'epics', task: 'tasks'}[scope.popupType]
        localResources[resource] = Object.create($rs[resource])
        localResources[resource].getByRef = (args...) ->
            $rs[resource].getByRef(args...).then (item) ->
                return $q.reject({status: 0}) if scope.$$destroyed
                return item
        controller = {us: 'UserStoryDetailController', issue: 'IssueDetailController', epic: 'EpicDetailController', task: 'TaskDetailController'}[scope.popupType]
        params = {pslug: scope.popupProject.get('slug')}
        params[scope.popupType + 'ref'] = scope.popupRef
        localAttachments = Object.create(attachments)
        localAttachments.loadAttachments = (args...) ->
            attachments.loadAttachments(args...).catch -> scope.loadFailed = true unless scope.$$destroyed
        scope.ctrl = $controller(controller, {
            $scope: scope, $routeParams: params, $tgResources: localResources,
            tgProjectService: localProject, tgAttachmentsFullService: localAttachments
        })
        scope.detailLoad.then ->
            scope.detailReady = true unless scope.$$destroyed
        .catch -> scope.loadFailed = true unless scope.$$destroyed
        scope.$on '$destroy', ->
            item = scope[scope.popupType]
            if transform.scope == scope
                transform.setObject(previousScope, previousProp)
            attachments.invalidatePendingLoads?()
            for key, value of previousAttachments
                attachments[key] = value
            projectService._project = previousProject
            projectService._activeMembers = previousMembers
            if previousScope && !previousScope.$$destroyed
                previousScope.$broadcast('object:updated')
                previousItem = previousScope[previousProp]
                if previousItem?._attrs && window.legacyChannel
                    window.legacyChannel.next({type: 'SET_DETAIL_OBJ', value: previousItem._attrs})
                previousScope.$broadcast('related-tasks:update') if scope.popupType == 'task'
            if item
                $rootScope.$broadcast(scope.popupType + 'form:edit:success', item)
                $rootScope.$broadcast('detail-popup:updated', {type: scope.popupType, item: item})
        lightboxService.open(el)
    return {link: link, templateUrl: 'common/lightbox/detail-popup.html'}

DetailPopupDirective.$inject = ['$controller', '$tgResources', '$rootScope', '$q', 'tgProjectService', '$tgQueueModelTransformation', 'tgAttachmentsFullService', 'lightboxService']
angular.module('taigaComponents').service('tgDetailPopup', DetailPopupService).directive('tgDetailPopup', DetailPopupDirective)
