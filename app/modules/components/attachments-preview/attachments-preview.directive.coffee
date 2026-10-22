###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

AttachmentPreviewLightboxDirective = (lightboxService, attachmentsPreviewService) ->
    link = ($scope, el, attrs, ctrl) ->
        keydown = (e) ->
            return unless el.hasClass('open') && !el.hasClass('close-started') && attachmentsPreviewService.fileId
            return unless e.keyCode in [37, 39]
            # Native video controls retarget their keyboard events to the video.
            # Preserve seeking while the player has focus, even if the event
            # is dispatched elsewhere; otherwise arrows navigate the carousel.
            focused = document.activeElement
            return if $(e.target).closest('video').length
            return if el[0].contains(focused) && $(focused).closest('video').length
            e.preventDefault()
            $scope.$evalAsync ->
                if e.keyCode == 39 then ctrl.next() else ctrl.previous()
            return
        $(document.body).on('keydown.image-preview', keydown)

        stopVideos = ->
            el[0].querySelectorAll('video').forEach (video) -> video.pause()

        $scope.$on 'lightbox:closed', ->
            if el.hasClass('close-started')
                stopVideos()
                attachmentsPreviewService.fileId = null

        $scope.$on '$destroy', () ->
            stopVideos()
            $(document.body).off('keydown.image-preview', keydown)

    return {
        scope: {},
        controller: 'AttachmentsPreview',
        templateUrl: 'components/attachments-preview/attachments-preview.html',
        link: link,
        controllerAs: "vm",
        bindToController: {
            attachments: "="
        }
    }

angular.module('taigaComponents').directive("tgAttachmentsPreview", [
    "lightboxService",
    "tgAttachmentsPreviewService",
    AttachmentPreviewLightboxDirective])
