###
# This source code is licensed under the GNU Affero General Public License.
###

class DetailPopupRefresh
    @.$inject = ['$rootScope', '$q', '$tgQueueModelTransformation', 'tgAttachmentsFullService']
    constructor: (@rootScope, @q, @transform, @attachments) ->

    observe: (scope) ->
        type = scope.popupType || 'task'
        publish = =>
            item = scope[type]
            return unless item && @transform.scope == scope
            @rootScope.$broadcast('detail-popup:changed', {type: type, item: item, projectId: scope.projectId})
        scope.$watch type + '.version', (value, previous) ->
            publish() if value != previous && previous != undefined
        initialized = false
        scope.$watch (=>
            if scope.attachmentsReady && @transform.scope == scope
                return @attachments.attachments.map((attachment) ->
                    file = attachment.get('file') || attachment
                    return ['id', 'modified_date', 'is_deprecated', 'order', 'name', 'thumbnail_card_url'].map((key) -> file.get(key)).join('|')
                ).join(';')
        ), (value, previous) ->
            return unless value != undefined
            if initialized && value != previous
                publish()
            initialized = true
        scope.$on 'related-tasks:update', publish

    listen: (scope, refresh, onError) ->
        running = false
        scheduled = false
        again = false
        schedule = =>
            return if scope.$$destroyed
            again = true
            return if running || scheduled
            scheduled = true
            scope.$evalAsync =>
                scheduled = false
                return if scope.$$destroyed
                again = false
                running = true
                @q.when().then(refresh).catch(onError).finally ->
                    running = false
                    schedule() if again
        updated = (event, detail) ->
            return unless detail.type in ['us', 'task']
            projectId = detail.projectId || detail.item?.project
            return unless String(projectId) == String(scope.projectId)
            schedule()
        scope.$on 'detail-popup:changed', updated
        scope.$on 'detail-popup:updated', updated
        scope.$on 'attachment:saved', updated

angular.module('taigaComponents')
    .service('tgDetailPopupRefresh', DetailPopupRefresh)
    .directive('tgDetailPopupRefresh', ['tgDetailPopupRefresh', (refresh) ->
        return {link: (scope) -> refresh.observe(scope)}
    ])
