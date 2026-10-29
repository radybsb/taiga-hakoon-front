###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

UserSettingsNavigationDirective = ->
    link = ($scope, $el, $attrs) ->
        section = $attrs.tgUserSettingsNavigation
        $scope.userSettingsNavigation = {open: false}
        $el.find(".active").removeClass("active")
        $el.find("#usersettingsmenu-#{section}").addClass("active")

        $el.on 'click', '#user-settings-navigation-items a', ->
            $scope.$evalAsync -> $scope.userSettingsNavigation.open = false
        $el.on 'keydown', (event) ->
            if event.key == 'Escape' and $scope.userSettingsNavigation.open
                event.preventDefault()
                event.stopPropagation()
                $scope.$apply -> $scope.userSettingsNavigation.open = false
                $el.find('.user-settings-menu-toggle').focus()

        $scope.$on "$destroy", ->
            $el.off()

    return {link:link}

module = angular.module("taigaUserSettings")
module.directive("tgUserSettingsNavigation", UserSettingsNavigationDirective)
