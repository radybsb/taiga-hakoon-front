###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

WatchersDirective = ($rootscope, $confirm, $repo, $modelTransform, $template,
$compile, $translate, $currentUserService) ->
    link = ($scope, $el, $attrs) ->
        $scope.compactUsers = !!$scope.$eval($attrs.compactUsers)
        compactActions = $scope.$eval($attrs.compactActions)
        $scope.activateCompactAvatar = (event) ->
            return unless $scope.compactUsers && event.key in ['Enter', ' ']
            event.preventDefault()
            event.currentTarget.click()
        $scope.visibleWatchersCount = 4
        $scope.displayHidden = false
        $scope.isAuthenticated = !!$currentUserService.getUser()

        isEditable = ->
            return !$scope.project?.archived_code and $scope.project?.my_permissions?.indexOf($attrs.requiredPerm) != -1

        isProjectArchived = ->
            return $scope.project?.archived_code

        render = () ->
            watchersIds = _.clone($scope.vm.item?.watchers, false)
            watchers = _.map(watchersIds, (watcherId) -> $scope.usersById[watcherId])
            watchers = _.filter watchers, (it) -> return !!it
            $scope.vm.watchers = _.compact(watchers)
            $scope.isEditable = isEditable()
            $scope.isProjectArchived = isProjectArchived()
            if compactActions
                compactActions.canManageWatchers = $scope.isEditable
                compactActions.canWatch = !$scope.isProjectArchived && $scope.isAuthenticated
                compactActions.addWatcher = -> $scope.vm.openWatchers()
                compactActions.watch = -> $scope.vm.watch()
                compactActions.unwatch = -> $scope.vm.unwatch()

        $scope.toggleFold = () ->
            $scope.displayHidden = !$scope.displayHidden

        $el.on "click", ".user-list-single", (event) ->
            return if not isEditable()
            event.stopPropagation()
            if $scope.compactUsers
                removeUser($(event.currentTarget).find('.remove-user').data('watcher-id'))
                return
            $scope.vm.openWatchers()

        $el.on "click", ".remove-user", (event) ->
            return if not isEditable()
            event.stopPropagation()
            removeUser($(event.currentTarget).data("watcher-id"))

        $scope.removeCompactUser = (event, userId) ->
            return unless $scope.compactUsers && isEditable()
            event.stopPropagation()
            removeUser(userId)

        removeUser = (watcherId) ->
            title = $translate.instant("COMMON.WATCHERS.TITLE_LIGHTBOX_DELETE_WARTCHER")
            message = $scope.usersById[watcherId].full_name_display

            $confirm.askOnDelete(title, message).then (askResponse) =>
                askResponse.finish()
                $scope.vm.deleteWatcher(watcherId)

        $scope.$on "watcher:added", (ctx, watcherId) ->
            watchersIds = _.clone($scope.item.watchers, false)
            watchersIds.push(watcherId)
            watchersIds = _.uniq(watchers)
            $scope.vm.save(watchersIds)

        $scope.$on "watchers:selected", (ctx, watchersIds) ->
            $scope.vm.save(watchersIds)

        $scope.$watch "vm.item" , (item) ->
            return if not item
            render()

        $scope.$on "$destroy", ->
            $el.off()

    return {
        scope: true,
        controller: "TicketWatchersController",
        bindToController: {
            item: "=",
            onWatch: "=",
            onUnwatch: "=",
            activeUsers: "="
        }
        controllerAs: "vm",
        templateUrl: "components/ticket-watchers/ticket-watchers.html",
        link: link
    }

WatchersDirective.$inject = [
    "$rootScope"
    "$tgConfirm"
    "$tgRepo"
    "$tgQueueModelTransformation"
    "$tgTemplate"
    "$compile"
    "$translate"
    "tgCurrentUserService"
]

angular.module("taigaComponents").directive("tgWatchers", WatchersDirective)
