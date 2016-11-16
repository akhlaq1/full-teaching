import { Component, OnInit, OnChanges, Input, EventEmitter, trigger, state, animate, transition, style } from '@angular/core';
import { ActivatedRoute, Params }   from '@angular/router';
import { Subscription }             from 'rxjs/Subscription';

import { MaterializeAction } from 'angular2-materialize';

import { CommentComponent } from '../comment/comment.component';

import { CourseDetailsModalDataService } from '../../services/course-details-modal-data.service';
import { FilesEditionService }   from '../../services/files-edition.service';
import { CourseService }         from '../../services/course.service';
import { SessionService }        from '../../services/session.service';
import { ForumService }          from '../../services/forum.service';
import { FileService }           from '../../services/file.service';
import { AuthenticationService } from '../../services/authentication.service';

import { Session }       from '../../classes/session';
import { Course }        from '../../classes/course';
import { Entry }         from '../../classes/entry';
import { Comment }       from '../../classes/comment';
import { FileGroup }     from '../../classes/file-group';
import { File }          from '../../classes/file';

@Component({
  selector: 'app-course-details',
  providers: [FilesEditionService],
  templateUrl: './course-details.component.html',
  styleUrls: ['./course-details.component.css'],
  animations: [
    trigger('fadeAnim', [
      state('commentsShown', style({
        opacity: 1
      })),
      state('commentsHidden', style({
        opacity: 0.2
      })),
      transition('commentsHidden => commentsShown', animate('.4s')),
      transition('commentsShown => commentsHidden', animate('.1s')),
    ]),
  ]
})
export class CourseDetailsComponent implements OnInit {

  course: Course;

  selectedEntry: Entry;

  fadeAnim = 'commentsHidden';

  //POST MODAL
  inputTitle: string;
  inputComment: string;
  inputDate: Date;
  inputTime: string;
  //postModalMode: 0 -> New entry | 1 -> New comment | 2 -> New session | 3 -> Add attenders | 4 -> Add fileGroup | 5 -> Add file
  postModalMode: number = 3;
  postModalTitle: string = "New session";
  postModalEntry: Entry;
  postModalCommentReplay: Comment;
  postModalFileGroup: FileGroup;

  //PUT-DELETE MODAL
  inputSessionTitle: string;
  inputSessionDescription: string;
  inputSessionDate: Date;
  inputSessionTime: string;
  updatedSession: Session;
  updatedSessionDate: string;
  allowSessionDeletion: boolean = false;

  allowForumEdition: boolean = false;

  inputFileTitle: string;
  updatedFileGroup: FileGroup;
  updatedFile: File;
  allowFilesEdition: boolean = false;
  checkboxForumEdition: string;
  //putdeleteModalMode: 0 -> Modify session | 1 -> Modify forum | 2 -> Modify file group | 3 -> Modify file
  putdeleteModalMode: number = 0;
  putdeleteModalTitle: string = "Modify session";

  filesEditionIcon: string = "mode_edit";

  private actions2 = new EventEmitter<string|MaterializeAction>();
  private actions3 = new EventEmitter<string|MaterializeAction>();

  subscription1: Subscription; //Subscription to service 'courseDetailsModalDataService' for receiving POST modal dialog changes
  subscription2: Subscription; //Subscription to service 'courseDetailsModalDataService' for receiving PUT/DELETE modal dialog changes
  subscription3: Subscription; //Subscription to service 'filesEditionService' for receiving FileGroup deletions
  subscription4: Subscription; //Subscription to service 'filesEditionService' for receiving FileGroup and File objects that are being updated

  constructor(
    private courseService: CourseService,
    private forumService: ForumService,
    private fileService: FileService,
    private sessionService: SessionService,
    private authenticationService: AuthenticationService,
    private route: ActivatedRoute,
    private courseDetailsModalDataService: CourseDetailsModalDataService,
    private filesEditionService: FilesEditionService) {

    //Subscription for receiving POST modal dialog changes
    this.subscription1 = this.courseDetailsModalDataService.postModeAnnounced$.subscribe(
      objs => {
        //objs is an array containing postModalMode, postModalTitle, postModalEntry, postModalCommentReplay and postModalFileGroup in that specific order
        this.postModalMode = objs[0];
        this.postModalTitle = objs[1];
        this.postModalEntry = objs[2];
        this.postModalCommentReplay = objs[3];
        this.postModalFileGroup = objs[4];
      });

    //Subscription for receiving PUT/DELETE modal dialog changes
    this.subscription2 = this.courseDetailsModalDataService.putdeleteModeAnnounced$.subscribe(
      objs => {
        //objs is an array containing putdeleteModalMode and putdeleteModalTitle, in that specific order
        this.putdeleteModalMode = objs[0];
        if (objs[1]) this.putdeleteModalTitle = objs[1]; //Only if the string is not empty
      });

    //Subscription for receiving FileGroup deletions
    this.subscription3 = this.filesEditionService.fileGroupDeletedAnnounced$.subscribe(
      fileGroupDeletedId => {
        //fileGroupDeletedId is the id of the FileGroup that has been deleted by the child component (FileGroupComponent)
        if (this.recursiveFileGroupDeletion(this.course.courseDetails.files, fileGroupDeletedId)){
          console.log("Succesful local deletion of FileGroup with id " + fileGroupDeletedId);
          if (this.course.courseDetails.files.length == 0) this.changeModeEdition(); //If there are no fileGroups, mode edit is closed
        }
      });

    //Subscription for receiving FileGroup and File objects that are being updated by the child component (FileGroupComponent)
    this.subscription4 = this.filesEditionService.fileFilegroupUpdatedAnnounced$.subscribe(
      objs => {
        //objs is an array containing updatedFileGroup and updatedFile, in that specific order
        if (objs[0]) {
          this.updatedFileGroup = objs[0];
          this.inputFileTitle = this.updatedFileGroup.title;
        }
        if (objs[1]) {
          this.updatedFile = objs[1];
          this.inputFileTitle = this.updatedFile.name;
        }
      });
  }

  ngOnInit() {
    this.route.params.forEach((params: Params) => {
      let id = +params['id'];
      this.courseService.getCourse(id).subscribe(
        course => {
          console.log("Course " + course.id + ":");
          console.log(course);
          this.sortSessionsByDate(course.sessions);
          this.course = course;
          this.selectedEntry = this.course.courseDetails.forum.entries[0]; //selectedEntry default to first entry
          if (this.course.sessions.length > 0) this.changeUpdatedSession(this.course.sessions[0]); //updatedSession default to first session
          this.updateCheckboxForumEdition(this.course.courseDetails.forum.activated);
        },
        error => console.log(error));
    });
  }

  updatePostModalMode(mode: number, title: string, header: Entry, commentReplay: Comment, fileGroup: FileGroup) {
    let objs = [mode, title, header, commentReplay, fileGroup];
    this.courseDetailsModalDataService.announcePostMode(objs);
  }

  updatePutDeleteModalMode(mode: number, title: string){
    let objs = [mode, title];
    this.courseDetailsModalDataService.announcePutdeleteMode(objs);
  }

  getLastEntryComment(entry: Entry){
    let comment = entry.comments[0];
    for (let c of entry.comments){
      if (c.date > comment.date) comment = c;
      comment = this.recursiveReplyDateCheck(comment);
    }
    return comment;
  }

  numberToDate(d: number){
    return new Date(d);
  }

  changeUpdatedSession(session: Session){
    this.updatedSession = session;
    this.updatedSessionDate = (new Date(this.updatedSession.date)).toISOString().split("T")[0]; //YYYY-MM-DD format
    this.inputSessionTitle = this.updatedSession.title;
    this.inputSessionDescription = this.updatedSession.description;
    this.inputSessionDate = new Date(this.updatedSession.date);
    this.inputSessionTime = this.dateToTimeInputFormat(this.inputSessionDate);
  }

  changeModeEdition(){
    this.allowFilesEdition = !this.allowFilesEdition;
    if (this.allowFilesEdition) {
      this.filesEditionIcon = "keyboard_arrow_left";
    }
    else {
      this.filesEditionIcon = "mode_edit";
    }
    this.filesEditionService.announceModeEdit(this.allowFilesEdition);
  }

  isCurrentPostMode(possiblePostModes: string[]): boolean {
    return (possiblePostModes.indexOf(this.postModalMode.toString()) > -1);
  }

  isCurrentPutdeleteMode(possiblePutdeleteModes: string[]): boolean {
    return (possiblePutdeleteModes.indexOf(this.putdeleteModalMode.toString()) > -1);
  }

  updateCheckboxForumEdition(b: boolean){
    if (b){
      this.checkboxForumEdition = "DEACTIVATION";
    } else {
      this.checkboxForumEdition = "ACTIVATION";
    }
  }

  //POST new Entry, Comment or Session
  onCourseDetailsSubmit() {

    //If modal is opened in "New Entry" mode
    if (this.postModalMode === 0) {
      console.log("Saving new Entry: Title -> " + this.inputTitle + "  |  Comment -> " + this.inputComment);
      let e = new Entry(this.inputTitle, [new Comment(this.inputComment, null)]);

      this.forumService.newEntry(e, this.course.courseDetails.id).subscribe( //POST method requires an Entry and the CourseDetails id that contains its Forum
        response  => {
          console.log(response);
          this.course.courseDetails.forum = response; //Only on succesful post we update the modified forum
          this.actions2.emit({action:"modal",params:['close']});
        },
        error => console.log(error)
      );
    }

    //If modal is opened in "New Session" mode
    else if (this.postModalMode === 2) {
      let date = new Date(this.inputDate);
      let hoursMins = this.inputTime.split(":");
      date.setHours(parseInt(hoursMins[0]), parseInt(hoursMins[1]));
      let s = new Session(this.inputTitle, this.inputComment, date.getTime());
      console.log(s);
      this.sessionService.newSession(s, this.course.id).subscribe(
        response => {
          console.log(response);
          this.sortSessionsByDate(response.sessions);
          this.course = response;
          this.actions2.emit({action:"modal",params:['close']});
        },
        error => console.log(error)
      );
    }

    //If modal is opened in "New Comment" mode (replaying or not replaying)
    else if (this.postModalMode === 1) {
      let c = new Comment(this.inputComment, this.postModalCommentReplay);
      console.log(c);
      this.forumService.newComment(c, this.selectedEntry.id, this.course.courseDetails.id).subscribe(
        response => {
          console.log(response);
          //Only on succesful post we locally update the created entry
          let ents = this.course.courseDetails.forum.entries;
          for (let i = 0; i < ents.length; i++) {
            if (ents[i].id == this.selectedEntry.id) {
              this.course.courseDetails.forum.entries[i] = response; //The entry with the required ID is updated
              this.selectedEntry = this.course.courseDetails.forum.entries[i];
              break;
            }
          }
          this.actions2.emit({action:"modal",params:['close']});
        },
        error => console.log(error)
      );
    }

    //If modal is opened in "New FileGroup" mode
    else if (this.postModalMode === 4) {
      let f = new FileGroup(this.inputTitle, this.postModalFileGroup);
      console.log(f);
      this.fileService.newFileGroup(f, this.course.courseDetails.id).subscribe(
        response => {
          console.log(response);
          //Only on succesful post we locally update the entire course details
          this.course.courseDetails = response;

          this.actions2.emit({action:"modal",params:['close']});
        },
        error => console.log(error)
      );
    }

    //If modal is opened in "New File" mode
    else if (this.postModalMode === 5) {
      let file = new File(1, this.inputTitle, "www.newlink.com");
      console.log(file);
      this.fileService.newFile(file, this.postModalFileGroup.id, this.course.courseDetails.id).subscribe(
        response => {
          console.log(response);

          //Only on succesful post we locally update the root filegroup that contains the created file
          for (let i = 0; i < this.course.courseDetails.files.length; i++) {
            if (this.course.courseDetails.files[i].id == response.id) {
              this.course.courseDetails.files[i] = response;
              break;
            }
          }
          this.actions2.emit({action:"modal",params:['close']});
        },
        error => console.log(error)
      );
    }
  }

  //PUT existing Session or Forum
  onPutDeleteSubmit(){

    //If modal is opened in PUT existing Session
    if(this.putdeleteModalMode === 0){
      let modifiedDate: number = this.fromInputToNumberDate(this.updatedSessionDate, this.inputSessionTime);
      let s: Session = new Session(this.inputSessionTitle, this.inputSessionDescription, modifiedDate);
      s.id = this.updatedSession.id; //The new session must have the same id as the modified session in order to replace it
      this.sessionService.editSession(s).subscribe(
        response => {
          console.log(response);
          //Only on succesful put we locally update the modified session
          for (let i = 0; i < this.course.sessions.length; i++) {
            if (this.course.sessions[i].id == response.id) {
              this.course.sessions[i] = response; //The session with the required ID is updated
              this.updatedSession = this.course.sessions[i];
              break;
            }
          }
          this.actions3.emit({action:"modal",params:['close']});
        },
        error => console.log(error)
      );
    }

    //If modal is opened in PUT existing Forum
    else if (this.putdeleteModalMode === 1){
      this.forumService.editForum(!this.course.courseDetails.forum.activated, this.course.courseDetails.id).subscribe(
        response => {
          console.log("Forum updated: active = " + response);
          //Only on succesful put we locally update the modified session
          this.course.courseDetails.forum.activated = response;
          this.allowForumEdition = false;
          this.updateCheckboxForumEdition(response);
          this.actions3.emit({action:"modal",params:['close']});
        },
        error => console.log(error)
      );
    }

    //If modal is opened in PUT existing FileGroup
    else if (this.putdeleteModalMode === 2){
      let fg: FileGroup = new FileGroup(this.inputFileTitle, null);
      fg.id = this.updatedFileGroup.id;
      this.fileService.editFileGroup(fg, this.course.id).subscribe(
        response => {
          console.log("FileGroup updated");
          console.log(response);
          for (let i = 0; i < this.course.courseDetails.files.length; i++) {
            if (this.course.courseDetails.files[i].id == response.id) {
              this.course.courseDetails.files[i] = response; //The root fileGroup with the required ID is updated
              //this.updatedFileGroup = this.course.courseDetails.files[i];
              break;
            }
          }
          this.actions3.emit({action:"modal",params:['close']});
        },
        error => console.log(error)
      );
    }

    //If modal is opened in PUT existing File
    else if (this.putdeleteModalMode === 3){
      let f: File = new File(1, this.inputFileTitle, "www.newlink.com");
      f.id = this.updatedFile.id;
      this.fileService.editFile(f, this.updatedFileGroup.id, this.course.id).subscribe(
        response => {
          console.log("File updated");
          console.log(response);
          for (let i = 0; i < this.course.courseDetails.files.length; i++) {
            if (this.course.courseDetails.files[i].id == response.id) {
              this.course.courseDetails.files[i] = response; //The root fileGroup with the required ID is updated
              //this.updatedFileGroup = this.course.courseDetails.files[i];
              break;
            }
          }
          this.actions3.emit({action:"modal",params:['close']});
        },
        error => console.log(error)
      );
    }
  }

  //DELETE existing Session
  deleteSession(){
    this.sessionService.deleteSession(this.updatedSession.id).subscribe(
      response => {
        console.log("Session deleted");
        console.log(response);
        //Only on succesful put we locally delete the session
        for (let i = 0; i < this.course.sessions.length; i++) {
          if (this.course.sessions[i].id == response.id) {
            this.course.sessions.splice(i, 1); //The session with the required ID is deleted
            this.updatedSession = this.course.sessions[0];
            break;
          }
        }
        this.actions3.emit({action:"modal",params:['close']});
      },
      error => console.log(error)
    );
  }


//PRIVATE AUXILIAR METHODS

//Sorts an array of Session by their 'date' attribute (the first are the erliest)
  private sortSessionsByDate(sessionArray: Session[]): void {
    sessionArray.sort(function(a,b) {return (a.date > b.date) ? 1 : ((b.date > a.date) ? -1 : 0);} );
  }

  //Transforms a Date object into a single string ("HH:MM")
  private dateToTimeInputFormat(date:Date): string {
    let hours = date.getHours() < 10 ? "0" + date.getHours().toString() : date.getHours().toString();
    let minutes = date.getMinutes() < 10 ? "0" + date.getMinutes().toString() : date.getMinutes().toString();
    return(hours + ":" + minutes);
  }

  //Transforms two strings ("YYYY-MM-DD", "HH:MM") into a new Date object
  private fromInputToNumberDate(date: string, time: string): number {
    let newDate: Date = new Date(date); //date parameter has a valid ISO format: YYYY-MM-DD
    let timeArray = time.split(":");
    newDate.setHours(parseInt(timeArray[0]));
    newDate.setMinutes(parseInt(timeArray[1]));
    return newDate.getTime(); //returning miliseconds
  }

  //Returns the earliest Comment (by 'date' attribute) in the recursive structure of comments which has Comment 'c' as root
  recursiveReplyDateCheck(c: Comment): Comment{
    for (let r of c.replies){
      if (r.date > c.date) c = r;
      c = this.recursiveReplyDateCheck(r);
    }
    return c;
  }

  //Delets a fileGroup from this.course.courseDetails.files recursively, given a fileGroup id
  recursiveFileGroupDeletion(fileGroupLevel: FileGroup[], fileGroupDeletedId: number): boolean{
    if (fileGroupLevel){
      for (let i = 0; i < fileGroupLevel.length; i++) {
        console.log("ONE STEP IN THE SEARCH");
        if (fileGroupLevel[i].id == fileGroupDeletedId){
          fileGroupLevel.splice(i, 1);
          return true;
        }
        let deleted = this.recursiveFileGroupDeletion(fileGroupLevel[i].fileGroups, fileGroupDeletedId);
        if (deleted) return deleted;
      }
    }
  }

}
