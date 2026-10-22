// Local visual harness: production templates, in-memory sample data, no API calls.
const previewTemplates = __COMPONENT_TEMPLATES__;
const sampleTasks = __SAMPLE_TASKS__;
const sampleAvatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="24" fill="#5963bb"/><text x="24" y="31" text-anchor="middle" font-family="sans-serif" font-size="20" fill="white">H</text></svg>');
const sampleCover = '/modern-workspace-sample.svg';
const previewModule = angular.module('taigaComponents');
function sampleFile(id, name, description) {
    const data = {file:{id, name, description, size:180000, url:sampleCover, thumbnail_card_url:sampleCover}, editable:false};
    return {get(path){return Array.isArray(path)?this.getIn(path):data[path];},getIn(path){return path.reduce((value,key)=>value&&value[key],data);},data};
}
previewModule.directive('tgSvg', function(){return {scope:{svgIcon:'@'},template:'<svg class="icon" aria-hidden="true" width="16" height="16"><use ng-attr-href="{{\'#\' + svgIcon}}"></use></svg>'};});
previewModule.directive('tgAvatar',function(){return {link(scope,element){element.attr('src',sampleAvatar);}};});
previewModule.filter('sizeFormat',function(){return size=>Math.round(size/1000)+' KB';});
previewModule.filter('momentFormat',function(){return ()=> '17 Oct 2026 10:30';});
previewModule.directive('tgAttachmentsFull',function(){return {
    scope:{},controllerAs:'vm',template:previewTemplates.attachments,
    controller:function($scope){
        this.type='us'; this.mode='gallery'; this.attachmentsVisible=[sampleFile(1,'workspace-design.png','Design reference'),sampleFile(2,'interaction-states.png','Interaction states')];
        this.attachments={size:this.attachmentsVisible.length}; this.uploadingAttachments=()=>[]; this.showAttachments=()=>true;
        this.setMode=mode=>this.mode=mode;
        this.deleteAttachment=file=>{this.attachmentsVisible=this.attachmentsVisible.filter(item=>item!==file);this.attachments.size=this.attachmentsVisible.length;};
        this.updateAttachment=()=>{};
        $scope.displayAttachmentInput=()=>window.alert('Sample preview only. Upload attachments from the actual project.');
    }
};});
for (const [name,key] of [['tgAttachment','attachment'],['tgAttachmentGallery','gallery']]) previewModule.directive(name,function(){return {
    scope:{attachment:'=',onDelete:'&',onUpdate:'&'},bindToController:true,controllerAs:'vm',template:previewTemplates[key],
    controller:function(){this.form={};this.editMode=value=>this.attachment.data.editable=value;this.save=()=>{this.attachment.data.file.description=this.form.description||this.attachment.data.file.description;this.attachment.data.editable=false;};this.delete=()=>this.onDelete({attachment:this.attachment});}
};});
previewModule.directive('previewRelatedTasks',function(){return {
    scope:{},template:previewTemplates.tasks,
    controller:function($scope){$scope.tasks=sampleTasks.map(task=>({...task}));$scope.showRelatedTasks=()=>true;}
};});
previewModule.directive('tgRelatedTaskCreateButton',function(){return {template:previewTemplates.addButton,link(scope,element){element.find('button').attr('title','Add task');element.on('click',()=>scope.$apply(()=>{scope.tasks.push({id:Date.now(),ref:44,subject:'New sample task',status_extra_info:{color:'#8981e9'},is_closed:false});}));}};});
previewModule.directive('tgRelatedTaskRow',function($compile){return {link(scope,element){element.html(previewTemplates.taskRows[scope.task.id]||previewTemplates.taskRows[42]);$compile(element.contents())(scope);}};});
previewModule.directive('tgRelatedTaskStatus',function(){return {link(scope,element){element.find('span').text(scope.task.is_closed?'Done':'In progress');}};});
previewModule.directive('tgRelatedTaskAssignedToInlineEdition',function(){return {link(scope,element){element.find('figure').html('<img alt="Hakoon team" src="'+sampleAvatar+'"><figcaption>Hakoon team</figcaption>');}};});
previewModule.directive('previewHistory',function(){return {scope:{},template:previewTemplates.history,controllerAs:'vm',controller:function(){
    this.id=128;this.type={id:128};this.name='Sample story';this.project={};this.viewComments=true;this.commentsNum=1;this.activitiesNum=1;
    this.showHistorySection=()=>true;this.showCommentTab=()=>true;this.showActivityTab=()=>true;this.onActiveHistoryTab=value=>this.viewComments=value;
    this.onOrderComments=()=>this.reverse=!this.reverse;
    this.comments=[{id:1,user:{name:'Hakoon team'},comment:'The attachment and task sections now use the same templates as the application.'}];
    this.activities=[{id:1,user:{name:'Hakoon team'},values_diff:{status:['To do','In progress']}}];
}};});
previewModule.directive('tgHistoryTabs',function(){return {scope:{showCommentTab:'&',showActivityTab:'&',onActiveComments:'&',onActiveActivities:'&',onOrderComments:'&',activeTab:'=',commentsNum:'=',activitiesNum:'=',onReverse:'='},template:previewTemplates.historyTabs};});
previewModule.directive('tgComments',function(){return {scope:{},bindToController:{comments:'=',reverse:'='},controllerAs:'vm',controller:function(){},template:previewTemplates.comments};});
previewModule.directive('tgComment',function(){return {scope:{},bindToController:{comment:'='},controllerAs:'vm',controller:function(){this.canEditDeleteComment=()=>false;},template:previewTemplates.comment};});
previewModule.directive('tgBindWysiwygHtml',function(){return {link(scope,element,attrs){scope.$watch(attrs.tgBindWysiwygHtml,value=>element.text(value||''));}};});
previewModule.directive('tgCommentWysiwyg',function(){return {template:'<tg-wysiwyg><div class="editor html-read-mode read-mode"><div><div class="wysiwyg"><textarea aria-label="Sample comment" placeholder="Write a comment…"></textarea></div></div></div></tg-wysiwyg>'};});
previewModule.directive('tgHistory',function(){return {scope:{activities:'='},template:previewTemplates.activities};});
previewModule.directive('tgHistoryDiff',function(){return {scope:{diff:'='},template:'<span>Status: {{diff[0]}} → {{diff[1]}}</span>'};});
previewModule.directive('previewWatchers',function(){return {scope:{},template:previewTemplates.watchers,controllerAs:'vm',controller:function($scope){
    this.item={is_watcher:false};this.watchers=[{id:1,full_name_display:'Hakoon team'}];this.watch=()=>this.item.is_watcher=true;this.unwatch=()=>this.item.is_watcher=false;
    this.openWatchers=()=>window.alert('Sample preview only. Manage watchers from the actual project.');
    $scope.visibleWatchersCount=4;$scope.isEditable=true;$scope.isAuthenticated=true;
}};});
previewModule.directive('previewDueDate',function(){return {scope:{},template:previewTemplates.dueDate,controllerAs:'vm',controller:function(){
    this.visible=()=>true;this.disabled=()=>false;this.color=()=>null;this.title=()=>'Set due date';this.setDueDate=()=>window.alert('Sample preview only. Set the due date from the actual project.');
}};});

previewModule.filter('emojify',function(){return value=>value;});
previewModule.directive('previewDetailHeader',function(){return {scope:{},controllerAs:'vm',template:previewTemplates.detailHeader,controller:function(){this.item={ref:128,subject:'A clearer way to organise your work'};this.sectionName='User story';this.permissions={canEdit:false};}};});
previewModule.directive('tgTag',function(){return {scope:{tag:'='},template:previewTemplates.tag};});
previewModule.directive('previewEstimation',function($compile){return {scope:{},template:previewTemplates.estimation,link(scope,element){
    const values={1:3,2:2};
    let picker;
    let selectedRole=1;
    function removePicker(){if(picker){picker.remove();picker=null;}}
    element.on('click',function(event){
        const point=event.target.closest('[data-point-id]');
        if(point){
            values[selectedRole]=Number(point.dataset.pointId);
            element[0].querySelector('[data-role-id="'+selectedRole+'"] .points').textContent=values[selectedRole];
            element[0].querySelector('.ticket-role-points:last-child .points').textContent=values[1]+values[2];
            removePicker();
            return;
        }
        const row=event.target.closest('.ticket-role-points[data-role-id]');
        if(!row)return;
        removePicker();selectedRole=Number(row.dataset.roleId);
        picker=angular.element(previewTemplates.pointPicker);
        picker.css('display','block');
        row.appendChild(picker[0]);
    });
    scope.$on('$destroy',()=>{element.off('click');removePicker();});
}};});
